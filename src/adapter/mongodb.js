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

    count(collection, ...args) {
        return this.getCollection(collection).count(...args);
    }

    find(collection, ...args) {
        return this.getCollection(collection).find(...args);
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
