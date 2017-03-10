const net = require('net');
const express = require('express');
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
const eventTypes = {
    updateCollection: 'update-collection',
    updateItem: 'update-item',
    removeCollection: 'remove-collection',
    removeItem: 'remove-item',
    insert: 'insert'
};

class Momentum {
    constructor(...args) {
        this.adapter = getAdapter(...args);
    }

    static addAdapter(name, adapter) {
        adapters[name] = adapter;
    }

    linkApplication(app) {
        this.linkedApp = app;
    }

    setApplicationPort(appPort) {
        this.appPort = appPort;
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
        this.events = new MomentumEventEmitter();

        return this.adapter.start();
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

        return this;
    }

    onEvent(eventKey, eventParam, args) {
        return this.on(eventTypes[eventKey] + ':' + eventParam, ...args);
    }

    onCollectionTouched(collection, ...args) {
        return this
            .onCollectionUpdate(collection, ...args)
            .onCollectionRemove(collection, ...args)
            .onInsert(collection, ...args);
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
                promise.then((err, result) => {
                    this.emit(eventTypes.removeCollection + ':' + collection, eventTypes.removeCollection, collection, err, result);
                    ids.forEach(id => {
                        this.emit(eventTypes.removeItem + ':' + collection + ':' + id, eventTypes.removeCollection, collection, id);
                    });
                });

                resolve(promise);
            });
        });
    }

    insertOne(collection, document, options) {
        const promise = this.adapter.insertOne(collection, document, options);
        promise.then((err, result) => {
            this.emit(eventTypes.insert + ':' + collection, eventTypes.insert, collection, err, result);
        });

        return promise;
    }

    updateOne(collection, filter, update, options) {
        return this.findOne(collection, filter).then(obj => {
            const id = this.getItemId(obj);
            const promise = this.adapter.updateOne(collection, filter, update, options);
            promise.then((err, result) => {
                this.emit(eventTypes.updateCollection + ':' + collection, eventTypes.updateCollection, collection, err, result);
                this.emit(eventTypes.updateItem + ':' + collection + ':' + id, eventTypes.updateCollection, collection, id);
            });

            return promise;
        });
    }

    getItemId(item) {
        return this.adapter.getItemId(item);
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
