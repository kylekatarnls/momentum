const net = require('net');
const express = require('express');
const bodyParser = require('body-parser');
const randomString = require('randomstring');
const fs = require('fs');
const uglify = require('uglify-js');
const mondogdbAdapter = require('./adapter/mongodb');
const MomentumEventEmitter = require('./event/emitter');
const adapters = {
    mongodb: mondogdbAdapter
};
const createAdapterInstance = (...args) => {
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

class MomentumServer {

    /**
     * Init a momentum server with an adapter (arguments
     * are passed to the adapter constructor).
     *
     * @param args
     */
    constructor(...args) {
        this.isReady = false;
        this.readyPromises = [];
        this.filters = {};
        this.options = {
            groupingDelay: 200,
            maxTokensPerIp: 16,
            maxEventsListeners: 131072,
            timeOut: 120000,
            collectionPrefix: 'mm_'
        };
        this.adapter = createAdapterInstance(...args);
        this.initializeEventsEmitter();
    }

    /**
     * Add a database adapter.
     *
     * @param {string}           name
     * @param {AdapterInterface} adapter
     */
    static addAdapter(name, adapter) {
        adapters[name] = adapter;
    }

    /**
     *
     * @param app
     * @param args
     *
     * @returns {Promise.<MomentumServer>}
     */
    static connect(app, ...args) {
        const momentum = new MomentumServer(...args);

        return momentum.start(app).then(() => {
            return momentum;
        });
    }

    /**
     * Reset events emitter instance.
     */
    initializeEventsEmitter() {
        this.eventsEmitter = null;
    }

    /**
     * Get the current momentum event emitter.
     * Instantiate it if not yet exist.
     *
     * @return {MomentumEventEmitter}
     */
    getEventsEmitter() {
        if (!this.eventsEmitter) {
            this.eventsEmitter = new MomentumEventEmitter();
            this.eventsEmitter.setMaxListeners(this.options.maxEventsListeners);
        }

        return this.eventsEmitter;
    }

    /**
     * Add a callback filter available from the API.
     *
     * @param {string}   filter   filter name
     * @param {Function} callback callback function to be called on
     *                            filter name requested
     */
    addFilter(filter, callback) {
        this.filters[filter] = callback;
    }

    /**
     * Return the callback function for a given filter name.
     *
     * @param {string} filter
     *
     * @return {Function|null}
     */
    getFilter(filter) {
        return this.filters[filter] || null;
    }

    /**
     * Return the authorization strategy.
     *
     * @return {Function<Promise>}
     */
    getAuthorizationStrategy() {
        return this.authorizationStrategy || (() => new Promise(resolve => {
            resolve(true);
        }));
    }

    /**
     * Set/replace the authorization strategy.
     * It must be a function that return a promise that resolve true or false.
     *
     * @param {Function} authorizationStrategy
     *
     * @return this
     */
    setAuthorizationStrategy(authorizationStrategy) {
        this.authorizationStrategy = authorizationStrategy;

        return this;
    }

    /**
     * Return a promise that will resolve true if the action is authorized
     * by the authorization strategy, and resolve false else.
     *
     * @param {string} mode
     * @param {string} method
     * @param {Array}  args
     * @param {Object} request
     * @param {Object} response
     *
     * @throws Error if authorization strategy is not a function or return a wrong value.
     *
     * @return {Promise}
     */
    isAllowed(mode, method, args, request, response) {
        const strategy = this.getAuthorizationStrategy();

        if (typeof strategy !== 'function') {
            throw new Error('Authorization strategy must be a function');
        }

        const authorization = strategy(mode, method, args, request, response);

        if (typeof authorization === 'boolean') {
            return new Promise(resolve => {
                resolve(authorization);
            });
        }

        if (authorization instanceof Promise) {
            return authorization;
        }

        throw new Error('Authorization strategy must return true, false or a promise');
    }

    /**
     * Change the URL prefix that will come between the host URL
     * and the route.
     *
     * @param {string} urlPrefix
     *
     * @return this
     */
    setUrlPrefix(urlPrefix) {
        this.urlPrefix = urlPrefix;

        return this;
    }

    /**
     * Return the current URL prefix.
     *
     * @returns {string}
     */
    getUrlPrefix() {
        return this.urlPrefix || '/api/mm/';
    }

    /**
     * Link an express app to the momentum server to
     * serve the momentum API from this app.
     *
     * @param {Object} app
     */
    linkApplication(app) {
        this.linkedApp = app;
    }

    /**
     * Set the application listen port.
     *
     * @param {int} appPort
     *
     * @return this
     */
    setApplicationPort(appPort) {
        this.appPort = appPort;

        return this;
    }

    /**
     * Invalidate tokens that match the given filter.
     *
     * @param {Object} filter
     *
     * @return {Promise}
     */
    invalidateTokens(filter) {
        const tokens = this.options.collectionPrefix + 'tokens';

        return this.remove(tokens, filter);
    }

    /**
     * Return a promise that will resolve true if the given token
     * is valid, and resolve false else.
     *
     * @param {string} token
     *
     * @return {Promise.<boolean>}
     */
    isTokenValid(token) {
        const tokens = this.options.collectionPrefix + 'tokens';
        return this.count(tokens, {token}).then(count => {
            return count > 0;
        });
    }

    /**
     * Add a GET route with the url prefix.
     */
    addRoute(route, callback) {
        this.app.get(this.getUrlPrefix() + route, callback);
    }

    /**
     * Add a POST route with the url prefix and the JSON body-parser.
     */
    addJsonRoute(route, callback) {
        this.app.post(this.getUrlPrefix() + route, bodyParser.json(), callback);
    }

    /**
     * Add the /ready route to the momentum server app.
     */
    addReadyRoute() {
        this.addRoute('ready', (request, response) => {
            const readyCallback = () => {
                const ip = getIpFromRequest(request);
                const tokens = this.options.collectionPrefix + 'tokens';
                this.count(tokens, {ip}).then(count => {
                    if (count >= this.options.maxTokensPerIp) {
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

            const readyPromise = new Promise(resolve => {
                this.readyPromises.push(resolve);
            });
            readyPromise.then(readyCallback);
        });
    }

    /**
     * Add the /quit route to the momentum server app.
     */
    addQuitRoute() {
        this.addRoute('quit', (request, response) => {
            const token = request.query.token;

            this.isTokenValid(token).then(valid => {
                if (!valid) {
                    response.status(500).json({
                        error: 'Invalid token ' + token
                    });

                    return;
                }

                this.invalidateTokens({token}).then(() => {
                    response.status(200).json({status: 'success'});
                });
            });
        });
    }

    /**
     * Add the /on route to the momentum server app.
     */
    addOnRoute() {
        this.addRoute('on', (request, response) => {
            request.setTimeout(0);
            let end;
            let timeout = setTimeout(() => {
                response.status(200).json({events: []});
                end();
            }, this.options.timeOut);
            let group = null;
            const token = request.query.token;
            const eventsCollection = this.options.collectionPrefix + 'events';
            const off = this.on('listen:' + token, (collection, id, filter, ...args) => {
                clearTimeout(timeout);
                this.insertOne(eventsCollection, {
                    token,
                    listen: {collection, id, filter},
                    args: JSON.stringify(args)
                }).then(() => {
                    if (!group) {
                        group = setTimeout(() => {
                            this.find(eventsCollection, {token}).then(events => {
                                off();
                                if (events && !response.headersSent) {
                                    response.status(200).json({
                                        events: events.map(event => {
                                            event.args = JSON.parse(event.args);
                                            event.args.push(this.getItemId(event));

                                            return event;
                                        })
                                    });
                                    end();
                                    const ids = events.map(event => this.getItemId(event));
                                    this.remove(eventsCollection, this.getFilterFromItemId({$in: ids}));
                                }
                            }).catch(off);
                        }, this.options.groupingDelay);
                    }
                });
            });
            end = () => {
                setTimeout(off, this.options.timeOut / 4);
            };
        });
    }

    /**
     * Add the /listen route to the momentum server app.
     */
    addListenRoute() {
        this.addJsonRoute('listen', (request, response) => {
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
                const id = request.body.id;
                const listener = (...args) => {
                    if (!filter) {
                        this.emit('listen:' + token, collection, id, filter, ...args);

                        return;
                    }

                    handler(args).then(newArgs => {
                        this.emit('listen:' + token, collection, id, filter, ...newArgs);
                    });
                };
                const check = () => {
                    setTimeout(() => {
                        this.isTokenValid(token).then(valid => {
                            (valid ? check : off)();
                        });
                    }, this.options.timeOut);
                };
                check();
                if (id) {
                    off = this.onItemTouched(collection, id, listener);
                    response.status(200).json({status: 'success'});

                    return;
                }

                off = this.onCollectionTouched(collection, listener);
                response.status(200).json({status: 'success'});

                this.on('listen-stop:' + token + ',' + JSON.stringify([collection, id || '', filter || '']), off);
            });
        });
    }

    /**
     * Add the /listen/stop route to the momentum server app.
     */
    addListenStopRoute() {
        this.addJsonRoute('listen/stop', (request, response) => {
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
                const id = request.body.id;
                this.emit('listen-stop:' + token + ',' + JSON.stringify([collection, id || '', filter || '']));

                response.status(200).json({status: 'success'});
            });
        });
    }

    /**
     * Proxy request from HTTP API to database.
     *
     * @param {string}   mode
     * @param {Object}   request
     * @param {Object}   response
     * @param {Array}    allowedMethods
     * @param {Function} transform
     */
    proxyDataBaseRequest(mode, request, response, allowedMethods, transform) {
        const method = request.body.method;
        const args = request.body.args;
        const token = request.body.token;

        this.isTokenValid(token).then(valid => {
            if (!valid) {
                response.status(500).json({
                    error: 'Invalid token ' + token
                });

                return;
            }

            const end = (status, data) => {
                const json = Object.assign({
                    args,
                    method
                }, data);

                if (method === 'insertOne') {
                    args.push(this.getItemId(args[1]));
                }

                response.status(status).json(json);
            };

            if (allowedMethods.indexOf(method) === -1) {
                end(400, {
                    error: method + ' method unknown'
                });

                return;
            }

            if (typeof request.body.args !== 'object' || request.body.args.length < 1) {
                end(403, {
                    error: 'Arguments cannot be empty'
                });

                return;
            }

            this.isAllowed(mode, method, args, request, response).then(isAllowed => {
                if (!isAllowed) {
                    end(403, {
                        error: method + ' not allowed with ' + JSON.stringify(args)
                    });

                    return;
                }

                return this[method](...args).then(result => transform(result));
            })
            .catch(error => ({
                error: error + ''
            }))
            .then(result => {
                if (result) {
                    // JSON stringify and parse remove all database dynamic properties
                    end(result.error ? 500 : 200, JSON.parse(JSON.stringify(result)));
                }
            });
        });
    }

    /**
     * Add the /emit route to the momentum server app.
     */
    addEmitRoute() {
        this.addJsonRoute('emit', (request, response) => {
            this.proxyDataBaseRequest('emit', request, response, [
                'insertOne',
                'insertMany',
                'updateOne',
                'updateMany',
                'remove'
            ], result => {
                const data = Object.assign({
                    result: result.result
                }, result);

                ['message', 'ops', 'connection'].forEach(key => {
                    delete data[key];
                });

                return data;
            });
        });
    }

    /**
     * Add the /emit route to the momentum server app.
     */
    addDataRoute() {
        this.addJsonRoute('data', (request, response) => {
            this.proxyDataBaseRequest('data', request, response, [
                'findOne',
                'find',
                'count'
            ], result => ({result}));
        });
    }

    /**
     * Start the momentum server (start the adapter and
     * start the API to listen the needed routes).
     *
     * @param {int|Object} app optional app to link or port to listen
     */
    start(app = null) {
        let appPort = null;
        if (!isNaN(app)) {
            appPort = app;
            app = null;
        }
        this.stop();
        this.setApplicationPort(appPort);
        this.linkApplication(app);
        this.server = null;
        this.app = this.linkedApp || this.startServer();
        this.addReadyRoute();
        this.addQuitRoute();
        this.addOnRoute();
        this.addDataRoute();
        this.addListenRoute();
        this.addListenStopRoute();
        this.addEmitRoute();
        this.initializeEventsEmitter();
        const start = new Promise(resolve => {
            let startAdapter, broadcastLibrary;
            const end = () => {
                if (startAdapter && broadcastLibrary) {
                    resolve();
                }
            };
            this.startAdapter().then(() => {
                startAdapter = true;
                end();
            });
            this.broadcastLibrary().then(() => {
                broadcastLibrary = true;
                end();
            });
        });
        start.then(() => {
            this.isReady = true;
            this.readyPromises.forEach(promise => {
                promise();
            });
            this.readyPromises = [];
        });

        return start;
    }

    /**
     * Minify and broadcast the library on /momentum.js route.
     */
    broadcastLibrary() {
        return new Promise(resolve => {
            fs.readFile(__dirname + '/../lib/momentum.js', 'utf8', (err, data) => {
                const result = uglify.minify({
                    'momentum.js': data
                }, {
                    sourceMap: {
                        filename: 'momentum.js',
                        url: './momentum.js.map'
                    }
                });
                this.addRoute('momentum.js', (request, response) => {
                    response.set('Content-Type', 'application/javascript; charset=utf-8');
                    response.send(data);
                });
                this.addRoute('momentum.min.js', (request, response) => {
                    response.set('Content-Type', 'application/javascript; charset=utf-8');
                    response.send(result.code);
                });
                this.addRoute('momentum.js.map', (request, response) => {
                    response.set('Content-Type', 'application/json; charset=utf-8');
                    response.send(result.map);
                });
                resolve();
            });
        });
    }

    /**
     * Start the database adapter.
     */
    startAdapter() {
        return this.adapter.start();
    }

    /**
     * Stop the database adapter.
     */
    stopAdapter() {
        return new Promise(resolve => {
            if (this.adapter) {
                const stopPromise = this.adapter.stop();
                if (stopPromise instanceof Promise) {
                    stopPromise.then(resolve).catch(resolve);

                    return;
                }
            }

            resolve();
        });
    }

    /**
     * Start a stand-alone express server.
     */
    startServer() {
        const expressApp = express();
        this.server = expressApp.listen(this.appPort);

        return expressApp;
    }

    /**
     * Stop the express server (if stand-alone).
     */
    stopServer() {
        return new Promise(resolve => {
            if (this.server) {
                this.server.close(() => {
                    resolve();
                });

                return;
            }

            resolve();
        });
    }

    /**
     * Stop the adapter and the momentum server.
     */
    stop() {
        this.isReady = false;

        return new Promise(resolve => {
            let adapterStopped = !this.adapter;
            let serverStopped = !this.server;
            const next = () => {
                if (adapterStopped && serverStopped) {
                    resolve();
                }
            };
            this.stopAdapter().then(() => {
                adapterStopped = true;
                next();
            });
            this.stopServer().then(() => {
                serverStopped = true;
                next();
            });
        });
    }

    /**
     * Listen events and return a function to stop listening with
     * calling it.
     *
     * @param {Array} events
     * @param {Array} args
     *
     * @returns {Function}
     */
    on(events, ...args) {
        if (!events) {
            throw new Error('event must be a string or an array');
        }

        if (!events.forEach) {
            events = [events];
        }

        events.forEach(event => {
            this.getEventsEmitter().on(event, ...args);
        });

        return () => {
            events.forEach(event => {
                this.getEventsEmitter().removeListener(event, ...args);
            });
        };
    }

    /**
     * Listen a momentum event from the eventTypes list.
     *
     * @param {string} eventKey
     * @param {string} eventParam
     * @param {Array}  args
     *
     * @returns {Function}
     */
    onEvent(eventKey, eventParam, args) {
        return this.on(eventTypes[eventKey] + ':' + eventParam, ...args);
    }

    /**
     * Listen events that touch a given collection
     * (update, remove, insert).
     *
     * @param {string} collection
     * @param {Array}  args
     *
     * @returns {Function}
     */
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

    /**
     * Listen events that touch a given collection
     * item (update, remove).
     *
     * @param {string} collection
     * @param {string} item
     * @param {Array}  args
     *
     * @returns {Function}
     */
    onItemTouched(collection, item, ...args) {
        const offItemRemove = this.onItemRemove(collection, item, ...args);
        const offItemUpdate = this.onItemUpdate(collection, item, ...args);

        return () => {
            offItemRemove();
            offItemUpdate();
        };
    }

    /**
     * Listen collection update event.
     *
     * @param {string} collection
     * @param {Array}  args
     *
     * @returns {Function}
     */
    onCollectionUpdate(collection, ...args) {
        return this.onEvent('updateCollection', collection, args);
    }

    /**
     * Listen collection item update event.
     *
     * @param {string} collection
     * @param {string} item
     * @param {Array}  args
     *
     * @returns {Function}
     */
    onItemUpdate(collection, item, ...args) {
        return this.onEvent('updateItem', collection + ':' + item, args);
    }

    /**
     * Listen collection remove event.
     *
     * @param {string} collection
     * @param {Array}  args
     *
     * @returns {Function}
     */
    onCollectionRemove(collection, ...args) {
        return this.onEvent('removeCollection', collection, args);
    }

    /**
     * Listen collection item remove event.
     *
     * @param {string} collection
     * @param {string} item
     * @param {Array}  args
     *
     * @returns {Function}
     */
    onItemRemove(collection, item, ...args) {
        return this.onEvent('removeItem', collection + ':' + item, args);
    }

    /**
     * Listen collection insert event.
     *
     * @param {string} collection
     * @param {Array}  args
     *
     * @returns {Function}
     */
    onInsert(collection, ...args) {
        return this.onEvent('insert', collection, args);
    }

    /**
     * Emit an event.
     *
     * @param {Array} args
     *
     * @returns this
     */
    emit(...args) {
        return this.getEventsEmitter().emit(...args);
    }

    /**
     * Emit a momentum event from eventTypes list.
     *
     * @param {string} eventKey
     * @param {Object} eventParam
     * @param {Array}  args
     *
     * @returns {*}
     */
    emitEvent(eventKey, eventParam, ...args) {
        const event = eventTypes[eventKey];

        return this.emit(event + ':' + eventParam, event, ...args);
    }

    /**
     * Emit an error event.
     *
     * @param {string} eventKey
     * @param {Object} eventParam
     * @param {Array}  args
     *
     * @returns {*}
     */
    emitError(eventKey, eventParam, ...args) {
        const event = eventTypes[eventKey] + '-error';

        return this.emit(event + ':' + eventParam, event, ...args);
    }

    /**
     * Emit event/error for each item id.
     *
     * @param {Array}  ids
     * @param {string} method
     * @param {string} itemEvent
     * @param {string} collection
     * @param {Object} event
     */
    emitForEachItem(ids, method, itemEvent, collection, event) {
        if (!method) {
            throw new Error('no method');
        }
        ids.forEach(id => {
            this[method](itemEvent, collection + ':' + id, Object.assign({
                id
            }, event));
        });
    }

    /**
     * Remove items.
     *
     * @param {string} collection
     * @param {Object} filter
     * @param {Object} options
     *
     * @returns {Promise}
     */
    remove(collection, filter, options) {
        return new Promise((resolve, reject) => {
            this.find(collection, filter).then(objects => {
                const ids = objects.map(obj => this.getItemId(obj));
                const promise = this.callAdapter('remove', collection, filter, options);
                const callback = method => result => {
                    const event = {
                        name: 'remove',
                        collection,
                        filter,
                        options,
                        result
                    };
                    this[method]('removeCollection', collection, Object.assign({
                        ids
                    }, event));
                    this.emitForEachItem(ids, method, 'removeItem', collection, event);
                };
                promise
                    .then(callback('emitEvent'))
                    .catch(callback('emitError'));

                resolve(promise);
            }).catch(reject);
        });
    }

    /**
     * Call adapter method if ready, else return a dead promise.
     *
     * @param {string} method
     * @param {Array}  args
     *
     * @returns {Promise}
     */
    callAdapter(method, ...args) {
        if (this.isReady) {
            return this.adapter[method](...args);
        }

        return new Promise(() => {});
    }

    /**
     * Call a write method on the adapter and emit
     * corresponding events.
     *
     * @param {string} method
     * @param {Array}  args
     * @param {Object} info
     * @param {Array}  events
     *
     * @returns {Promise}
     */
    callWithEvents(method, args, info, events) {
        const promise = this.callAdapter(method, ...args);
        const callback = emitFunction => result => {
            events.forEach(event => {
                emitFunction.call(this, ...event, info, method, result);
            });
        };
        promise
            .then(callback(this.emitEvent))
            .catch(callback(this.emitError));

        return promise;
    }

    /**
     * Insert one or many item(s).
     *
     * @param {string}       collection
     * @param {Object|Array} document
     * @param {Object}       options
     * @param {string}       type
     *
     * @returns {Promise}
     */
    insert(collection, document, options, type) {
        if (!type) {
            type = document instanceof Array ? 'insertMany' : 'insertOne';
        }

        return this.callWithEvents(
            type, [
                collection,
                document,
                options
            ], {
                name: 'insert',
                collection,
                [type === 'insertMany' ? 'items' : 'item']: document,
                options
            }, [
                ['insert', collection]
            ]
        );
    }

    /**
     * Insert one item.
     *
     * @param {string} collection
     * @param {Object} document
     * @param {Object} options
     *
     * @returns {Promise}
     */
    insertOne(collection, document, options) {
        return this.insert(collection, document, options, 'insertOne');
    }

    /**
     * Insert one item.
     *
     * @param {string} collection
     * @param {Array}  documents
     * @param {Object} options
     *
     * @returns {Promise}
     */
    insertMany(collection, documents, options) {
        return this.insert(collection, documents, options, 'insertMany');
    }

    /**
     * Update one item.
     *
     * @param {string} collection
     * @param {Object} filter
     * @param {Object} update
     * @param {Object} options
     *
     * @returns {Promise}
     */
    updateOne(collection, filter, update, options) {
        return this.findOne(collection, filter).then(item => {
            if (!item) {
                throw new Error(JSON.stringify([collection, filter]) + ' not found');
            }

            const id = this.getItemId(item);
            return this.callWithEvents(
                'updateOne', [
                    collection,
                    filter,
                    update,
                    options
                ], {
                    name: 'update',
                    collection,
                    item,
                    id,
                    filter,
                    update,
                    options
                }, [
                    ['updateCollection', collection],
                    ['updateItem', collection + ':' + id]
                ]
            );
        });
    }

    /**
     * Update many items.
     *
     * @param {string} collection
     * @param {Object} filter
     * @param {Object} update
     * @param {Object} options
     *
     * @returns {Promise}
     */
    updateMany(collection, filter, update, options) {
        return new Promise((resolve, reject) => {
            this.find(collection, filter).then(objects => {
                const ids = objects.map(obj => this.getItemId(obj));
                const promise = this.callAdapter('updateMany', collection, filter, update, options);
                const callback = method => result => {
                    const event = {
                        name: 'update',
                        collection,
                        update,
                        filter,
                        options,
                        result
                    };
                    this[method]('updateCollection', collection, Object.assign({
                        ids
                    }, event));
                    this.emitForEachItem(ids, method, 'updateItem', collection, event);
                };
                promise
                    .then(callback('emitEvent'))
                    .catch(callback('emitError'));

                resolve(promise);
            }).catch(reject);
        });
    }

    /**
     * Return id for a given item.
     *
     * @param {Object} item
     *
     * @returns {string|int}
     */
    getItemId(item) {
        return this.adapter.getItemId(item);
    }

    /**
     * Return filter object for a given id.
     *
     * @param {string|int} itemId
     *
     * @returns {Object}
     */
    getFilterFromItemId(itemId) {
        return this.adapter.getFilterFromItemId(itemId);
    }

    /**
     * Count items.
     *
     * @param args
     *
     * @returns {Promise}
     */
    count(...args) {
        return this.callAdapter('count', ...args);
    }

    /**
     * Find items.
     *
     * @param args
     *
     * @returns {Promise}
     */
    find(...args) {
        return this.callAdapter('find', ...args);
    }

    /**
     * Find one item.
     *
     * @param args
     *
     * @returns {Promise}
     */
    findOne(...args) {
        return this.callAdapter('findOne', ...args);
    }
}

module.exports = MomentumServer;
