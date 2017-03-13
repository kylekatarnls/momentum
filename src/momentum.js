const net = require('net');
const express = require('express');
const bodyParser = require('body-parser');
const randomString = require('randomstring');
const mondogbAdapter = require('./adapter/mongodb');
const MomentumEventEmitter = require('./event/emitter');
const adapters = {
    mongodb: mondogbAdapter
};
const getAdapter = (...args) => {
    const names = Object.keys(adapters);
    while (names.length) {
        const name = names.shift();
        const AdapterClass = adapters[name];
        if (AdapterClass.isCompatible(...args)) {
            return new AdapterClass(...args);
        }
    }

    return null;
};
const getIpFromRequest = request => {
    return request.headers['x-forwarded-for'] || request.connection.remoteAddress;
};
const eventTypes = {
    updateCollection: 'update-collection',
    updateItem: 'update-item',
    removeCollection: 'remove-collection',
    removeItem: 'remove-item',
    insert: 'insert'
};

class Momentum {
    constructor(...args) {
        this.isReady = false;
        this.readyPromises = [];
        this.filters = {};
        this.options = {
            maxTokensPerIp: 16,
            timeOut: 120000,
            collectionPrefix: 'mm_'
        };
        this.adapter = getAdapter(...args);
    }

    static addAdapter(name, adapter) {
        adapters[name] = adapter;
    }

    static connect(app, ...args) {
        const momentum = new Momentum(...args);

        return momentum.start(app).then(() => {
            return momentum;
        });
    }

    addFilter(filter, callback) {
        this.filters[filter] = callback;
    }

    getFilter(filter) {
        return this.filters[filter] || null;
    }

    getAuthorizationStrategy() {
        return this.authorizationStrategy || (() => {
            return new Promise(resolve => {
                resolve(true);
            });
        });
    }

    setAuthorizationStrategy(authorizationStrategy) {
        return this.authorizationStrategy = authorizationStrategy;
    }

    isAllowed(mode, method, args, request, response) {
        return this.getAuthorizationStrategy()(mode, method, args, request, response);
    }

    setUrlPrefix(urlPrefix) {
        this.urlPrefix = urlPrefix;
    }

    getUrlPrefix() {
        return this.urlPrefix || '/api/mm/';
    }

    linkApplication(app) {
        this.linkedApp = app;
    }

    setApplicationPort(appPort) {
        this.appPort = appPort;
    }

    isTokenValid(token) {
        const tokens = this.options.collectionPrefix + 'tokens';
        return this.count(tokens, {token}).then(count => {
            return count > 0;
        });
    }

    start(app = null) {
        let appPort = null;
        if (!isNaN(app)) {
            appPort = app;
            app = null;
        }
        this.stop();
        this.setApplicationPort(appPort);
        this.linkApplication(app);
        this.app = this.linkedApp || (() => {
            const expressApp = express();
            this.server = expressApp.listen(this.appPort);

            return expressApp;
        })();
        this.app.get(this.getUrlPrefix() + 'ready', (request, response) => {
            const readyCallback = () => {
                const ip = getIpFromRequest(request);
                const tokens = this.options.collectionPrefix + 'tokens';
                this.count(tokens, {ip}).then(count => {
                    if (count > this.options.maxTokensPerIp) {
                        response.status(429).json({
                            error: 'Too many connections'
                        });

                        return;
                    }

                    const time = (new Date()).getTime();
                    const start = time - 2 * this.options.timeOut;
                    this.remove(tokens, {updatedAt: {$lt: start}}).then(() => {
                        const token = {
                            token: randomString.generate({
                                charset: 'alphanumeric',
                                length: 24
                            }),
                            updatedAt: time,
                            ip
                        };
                        this.insertOne(tokens, token).then(() => {
                            response.status(200).json({
                                status: 'success',
                                token: token.token
                            });
                        });
                    });
                });
            };
            if (this.isReady) {
                readyCallback();

                return;
            }

            const readyPromise = new Promise();
            readyPromise.then(readyCallback);

            this.readyPromises.push(readyPromise);
        });
        this.app.get(this.getUrlPrefix() + 'on', (request, response) => {
            let end;
            let timeout = setTimeout(() => {
                response.status(200).json({events: []});
                end();
            }, this.options.timeOut);
            let group = null;
            const token = request.query.token;
            const eventsCollection = this.options.collectionPrefix + 'events';
            const off = this.on('listen:' + token, (...args) => {
                clearTimeout(timeout);
                this.insertOne(eventsCollection, {
                    token,
                    args: JSON.stringify(args)
                }).then(() => {
                    if (!group) {
                        group = setTimeout(() => {
                            this.find(eventsCollection, {token}).toArray((err, events) => {
                                if (!err && events && !response.headerSent) {
                                    response.status(200).json({
                                        events: events.map(event => {
                                            event.args = JSON.parse(event.args);

                                            return event;
                                        })
                                    });
                                    end();
                                    events.forEach(event => {
                                        this.remove(eventsCollection, this.getFilterFromItemId(event));
                                    });
                                }
                            });
                        }, 200);
                    }
                });
            });
            end = () => {
                setTimeout(off, this.options.timeOut / 4);
            };
        });
        this.app.post(this.getUrlPrefix() + 'listen', bodyParser.json(), (request, response) => {
            const token = request.body.token;
            const collection = request.body.collection;
            if (!collection) {
                response.status(400).json({
                    error: 'Missing collection name'
                });

                return;
            }
            this.isTokenValid(token).then(valid => {
                if (!valid) {
                    response.status(500).json({
                        error: 'Invalid token ' + token
                    });

                    return;
                }

                const filter = request.body.filter;
                let handler;
                if (filter) {
                    handler = this.getFilter(filter);
                    if (!handler) {
                        response.status(400).json({
                            error: 'Unknown filter ' + filter
                        });

                        return;
                    }
                }
                let off;
                const listener = (...args) => {
                    if (!filter) {
                        this.emit('listen:' + token, ...args);

                        return;
                    }

                    handler(args).then(args => {
                        this.emit('listen:' + token, ...args);
                    });
                };
                const check = () => {
                    setTimeout(() => {
                        this.isTokenValid(token).then(valid => {
                            valid ?
                                check() :
                                off();
                        });
                    }, this.options.timeOut);
                };
                check();
                const id = request.body.id;
                if (id) {
                    off = this.onItemTouched(collection, id, listener);
                    response.status(200).json({status: 'success'});

                    return;
                }

                off = this.onCollectionTouched(collection, listener);
                response.status(200).json({status: 'success'});
            });
        });
        this.app.post(this.getUrlPrefix() + 'emit', bodyParser.json(), (request, response) => {
            const method = request.body.method;
            const args = request.body.args;
            if (['insertOne', 'updateOne', 'remove'].indexOf(method) === -1) {
                response.status(400).json({
                    error: method + ' method unknown'
                });

                return;
            }

            if (!this.isAllowed('emit', method, args, request, response)) {
                response.status(403).json({
                    error: method + ' not allowed with ' + JSON.stringify(args)
                });

                return;
            }

            this[method](...args).then(result => {
                response.status(200).json(result);
            }).catch(error => {
                response.status(500).json({error});
            });
        });
        this.events = new MomentumEventEmitter();
        const start = this.adapter.start();
        start.then(() => {
            this.isReady = true;
            this.readyPromises.forEach(promise => {
                promise.resolve();
            });
            this.readyPromises = [];
        });

        return start;
    }

    stop() {
        if (this.adapter) {
            this.adapter.stop();
        }
        if (this.server) {
            this.server.close();
        }
    }

    on(events, ...args) {
        if (!events) {
            throw new Error('event must be a string or an array');
        }
        if (!events.forEach) {
            events = [events];
        }
        events.forEach(event => {
            this.events.on(event, ...args);
        });

        return () => {
            events.forEach(event => {
                this.events.removeListener(event, ...args);
            });
        };
    }

    onEvent(eventKey, eventParam, args) {
        return this.on(eventTypes[eventKey] + ':' + eventParam, ...args);
    }

    onCollectionTouched(collection, ...args) {
        const offCollectionUpdate = this.onCollectionUpdate(collection, ...args);
        const offCollectionRemove = this.onCollectionRemove(collection, ...args);
        const offInsert = this.onInsert(collection, ...args);

        return () => {
            offCollectionUpdate();
            offCollectionRemove();
            offInsert();
        };
    }

    onItemTouched(collection, item, ...args) {
        const offItemRemove = this.onItemRemove(collection, item, ...args);
        const offItemUpdate = this.onItemUpdate(collection, item, ...args);

        return () => {
            offItemRemove();
            offItemUpdate();
        };
    }

    onCollectionUpdate(collection, ...args) {
        return this.onEvent('updateCollection', collection, args);
    }

    onItemUpdate(collection, item, ...args) {
        return this.onEvent('updateItem', collection + ':' + item, args);
    }

    onCollectionRemove(collection, ...args) {
        return this.onEvent('removeCollection', collection, args);
    }

    onItemRemove(collection, item, ...args) {
        return this.onEvent('removeItem', collection + ':' + item, args);
    }

    onInsert(collection, ...args) {
        return this.onEvent('insert', collection, args);
    }

    emit(...args) {
        return this.events.emit(...args);
    }

    remove(collection, filter, options) {
        return new Promise((resolve, reject) => {
            this.find(collection, filter).toArray((err, objs) => {
                if (err) {
                    reject(err);

                    return;
                }

                const ids = objs.map(obj => this.getItemId(obj));
                const promise = this.adapter.remove(collection, filter, options);
                promise.then(result => {
                    const args = ['remove', collection, ids, filter, result];
                    this.emit(eventTypes.removeCollection + ':' + collection, eventTypes.removeCollection, ...args);
                    ids.forEach(id => {
                        const itemArgs = args.slice();
                        itemArgs[2] = id;
                        this.emit(eventTypes.removeItem + ':' + collection + ':' + id, eventTypes.removeItem, ...itemArgs);
                    });
                });

                resolve(promise);
            });
        });
    }

    insertOne(collection, document, options) {
        const promise = this.adapter.insertOne(collection, document, options);
        promise.then(result => {
            const args = ['insertOne', collection, document, result];
            this.emit(eventTypes.insert + ':' + collection, eventTypes.insert, ...args);
        });

        return promise;
    }

    updateOne(collection, filter, update, options) {
        return this.findOne(collection, filter).then(obj => {
            const id = this.getItemId(obj);
            const promise = this.adapter.updateOne(collection, filter, update, options);
            promise.then(result => {
                const args = ['updateOne', collection, obj, id, filter, update, result];
                this.emit(eventTypes.updateCollection + ':' + collection, eventTypes.updateCollection, ...args);
                this.emit(eventTypes.updateItem + ':' + collection + ':' + id, eventTypes.updateItem, ...args);
            });

            return promise;
        });
    }

    getItemId(item) {
        return this.adapter.getItemId(item);
    }

    getFilterFromItemId(item) {
        return this.adapter.getFilterFromItemId(item);
    }

    count(...args) {
        return this.adapter.count(...args);
    }

    find(...args) {
        return this.adapter.find(...args);
    }

    findOne(...args) {
        return this.adapter.findOne(...args);
    }
}

module.exports = Momentum;
