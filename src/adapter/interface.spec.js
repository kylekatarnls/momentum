const AdapterInterface = require('./interface');

class BadAdapter extends AdapterInterface {
}

describe('AdapterInterface', () => {
    it('must implement all methods', () => {
        expect(BadAdapter.isCompatible).toThrow(new Error('Adapter should implement static isCompatible()'));
        const badAdapter = new BadAdapter();
        expect(badAdapter.start).toThrow(new Error('Adapter should implement start()'));
        expect(badAdapter.updateOne).toThrow(new Error('Adapter should implement updateOne()'));
        expect(badAdapter.updateMany).toThrow(new Error('Adapter should implement updateMany()'));
        expect(badAdapter.count).toThrow(new Error('Adapter should implement count()'));
        expect(badAdapter.find).toThrow(new Error('Adapter should implement find()'));
        expect(badAdapter.findOne).toThrow(new Error('Adapter should implement findOne()'));
        expect(badAdapter.insertOne).toThrow(new Error('Adapter should implement insertOne()'));
        expect(badAdapter.insertMany).toThrow(new Error('Adapter should implement insertMany()'));
        expect(badAdapter.remove).toThrow(new Error('Adapter should implement remove()'));
    });
});
