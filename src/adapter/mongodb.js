const mongodb = require('mongodb');
const AdapterInterface = require('./interface');

class MongodbAdapter extends AdapterInterface {
    constructor(url) {
        super();
        this.url = url;
    }

    static isCompatible(connector) {
        return connector.indexOf('mongodb://') === 0;
    }

    getCollection(name) {
        if (!name || !name.length || typeof name !== 'string') {
            throw new Error('Collection name must be a non-empty string');
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
        return (item || {})._id;
    }

    getFilterFromItemId(id) {
        return {_id: id};
    }

    count(collection, ...args) {
        return this.getCollection(collection).count(...args);
    }

    find(collection, ...args) {
        const query = this.getCollection(collection).find(...args);
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
        const _then = promise.then;
        const _catch = promise.catch;
        promise.query = query;
        promise.sort = (...args) => {
            query.sort(...args);

            return promise;
        };
        promise.limit = (...args) => {
            query.limit(...args);

            return promise;
        };
        promise.then = (...args) => {
            const result = _then.apply(promise, args);
            call();

            return result;
        };
        promise.catch = (...args) => {
            const result = _catch.apply(promise, args);
            call();

            return result;
        };

        return promise;
    }

    findOne(collection, ...args) {
        return this.getCollection(collection).findOne(...args);
    }

    insertOne(collection, ...args) {
        return this.getCollection(collection).insertOne(...args);
    }

    insertMany(collection, ...args) {
        return this.getCollection(collection).insertMany(...args);
    }

    updateOne(collection, ...args) {
        return this.getCollection(collection).updateOne(...args);
    }

    updateMany(collection, ...args) {
        return this.getCollection(collection).updateMany(...args);
    }

    remove(collection, ...args) {
        return this.getCollection(collection).remove(...args);
    }
}

module.exports = MongodbAdapter;
