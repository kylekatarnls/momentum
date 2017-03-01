class AdapterInterface {
    static isCompatible() {
        throw new Error('Adapter should implement static isCompatible()');
    }
    start() {
        throw new Error('Adapter should implement start()');
    }
    updateOne() {
        throw new Error('Adapter should implement updateOne()');
    }
    updateMany() {
        throw new Error('Adapter should implement updateMany()');
    }
    count() {
        throw new Error('Adapter should implement count()');
    }
    find() {
        throw new Error('Adapter should implement find()');
    }
    findOne() {
        throw new Error('Adapter should implement findOne()');
    }
    insertOne() {
        throw new Error('Adapter should implement insertOne()');
    }
    insertMany() {
        throw new Error('Adapter should implement insertMany()');
    }
    remove() {
        throw new Error('Adapter should implement remove()');
    }
}

module.exports = AdapterInterface;
