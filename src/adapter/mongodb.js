const mongodb = require('mongodb');
const AdapterInterface = require('./interface');
const ObjectID = mongodb.ObjectID;

class MongodbAdapter extends AdapterInterface {
    constructor(url) {
        super();
        this.url = url.replace(/^([^:\/]*):([^/])/, '$1://$2');
    }

    static isCompatible(connector) {
        return connector.indexOf('mongodb:') === 0;
    }

    getCollection(name) {
        if (!name || !name.length || typeof name !== 'string') {
            throw new Error('Collection name must be a non-empty string\n' + (new Error()).stack);
        }

        return this.db.collection(name);
    }

    start() {
        return new Promise((resolve, reject) => {
            mongodb.MongoClient.connect(this.url, (err, db) => {
                if (err) {
                    reject(err);

                    return;
                }

                this.db = db;
                resolve(db);
            });
        });
    }

    stop() {
        return new Promise(resolve => {
            if (this.db) {
                this.db.close(resolve);

                return;
            }

            resolve();
        });
    }

    getItemId(item) {
        const id = (item || {})._id;
        return id ? id + '' : id;
    }

    formatIds(obj) {
        if (typeof obj === 'object') {
            if (Array.isArray(obj)) {
                return obj.map(element => {
                    return this.formatIds(element);
                });
            }

            if (obj._id && !(obj._id instanceof ObjectID)) {
                obj._id = new ObjectID(obj._id);
            }
        }

        return obj;
    }

    getFilterFromItemId(id) {
        return this.formatIds({_id: id});
    }

    callOnCollection(collection, method, args) {
        return this.getCollection(collection)[method](...this.formatIds(args));
    }

    count(collection, ...args) {
        return this.callOnCollection(collection, 'count', args);
    }

    find(collection, filter, projection, methods) {
        const query = this.callOnCollection(collection, 'find', [filter, projection]);
        let callee;
        const promise = new Promise((resolve, reject) => {
            callee = () => {
                query.toArray((err, result) => {
                    if (err) {
                        reject(err);

                        return;
                    }

                    resolve(result);
                });
            };
        });
        const call = () => {
            if (callee) {
                callee();
                callee = null;
            }
        };
        promise.query = query;
        promise.sort = (...args) => {
            query.sort(...args);

            return promise;
        };
        promise.limit = (...args) => {
            query.limit(...args);

            return promise;
        };
        for (let method in methods) {
            if (methods.hasOwnProperty(method)) {
                promise[method](...methods[method]);
            }
        }
        const wrap = method => (...args) => {
            const result = method.apply(promise, args);
            call();

            return result;
        };
        promise.then = wrap(promise.then);
        promise.catch = wrap(promise.catch);

        return promise;
    }

    findOne(collection, ...args) {
        return this.callOnCollection(collection, 'findOne', args);
    }

    insertOne(collection, ...args) {
        return this.callOnCollection(collection, 'insertOne', args);
    }

    insertMany(collection, ...args) {
        return this.callOnCollection(collection, 'insertMany', args);
    }

    updateOne(collection, ...args) {
        return this.callOnCollection(collection, 'updateOne', args);
    }

    updateMany(collection, ...args) {
        return this.callOnCollection(collection, 'updateMany', args);
    }

    remove(collection, ...args) {
        return this.callOnCollection(collection, 'remove', args);
    }
}

module.exports = MongodbAdapter;
