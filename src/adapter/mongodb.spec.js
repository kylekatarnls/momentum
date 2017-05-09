const ObjectID = require('mongodb').ObjectID;
const MongodbAdapter = require('./mongodb');

describe('MongodbAdapter', () => {
    it('should be compatible only with mongodb', () => {
        expect(MongodbAdapter.isCompatible('mongodb://foo')).toBe(true);
        expect(MongodbAdapter.isCompatible('mysql://foo')).toBe(false);
    });
    it('should be have the url property set to the input', () => {
        const mongoAdapter = new MongodbAdapter('mongodb://localhost:27017/momentum');
        expect(mongoAdapter.url).toBe('mongodb://localhost:27017/momentum');
    });
    it('should throw an exception if collection name is wrong', () => {
        const mongoAdapter = new MongodbAdapter('mongodb://localhost:27017/momentum');
        expect(() => mongoAdapter.getCollection(null)).toThrow(new Error('Collection name must be a non-empty string'));
    });
    it('should reject if start failed', done => {
        const mongoAdapter = new MongodbAdapter('mongodb://999.999.999.999:999/momentum');
        let error = null;
        mongoAdapter.start().catch(err => {
            error = err;

            return err;
        }).then(() => {
            expect(error + '').toContain('MongoError: failed to connect to server [999.999.999.999:999] on first connect');
            done();
        });
    });
    it('should return an id from an item with getItemId', () => {
        const mongoAdapter = new MongodbAdapter('mongodb://localhost:27017/momentum');
        const id = new ObjectID();
        expect(mongoAdapter.getItemId({_id: id})).toBe(id + '');
        expect(mongoAdapter.getItemId(null)).toBe(undefined);
    });
    it('should handle find failures', done => {
        const mongoAdapter = new MongodbAdapter('mongodb://localhost:27017/momentum');
        mongoAdapter.start().then(() => {
            const promise = mongoAdapter.find('foo', {});
            promise.query.toArray = callback => {
                callback('foobar');
            };
            promise.catch(error => {
                expect(error).toBe('foobar');
                done();
            });
        });
    });
    it('should return a filter from an item id with getFilterFromItemId', () => {
        const mongoAdapter = new MongodbAdapter('mongodb://localhost:27017/momentum');
        const id = new ObjectID();
        expect(mongoAdapter.getFilterFromItemId(id)).toEqual({_id: id});
    });
    it('should store and get elements', done => {
        const mongoAdapter = new MongodbAdapter('mongodb://localhost:27017/momentum');
        mongoAdapter.start().then(() => {
            mongoAdapter.remove('unitTests', {}).then(status => {
                expect(status.result.ok).toBe(1);
                mongoAdapter.insertMany('unitTests', [{a: 1, b: 3}, {a: 2, d: 1}]).then(status => {
                    expect(status.result.ok).toBe(1);
                    mongoAdapter.count('unitTests').then(count => {
                        expect(count).toBe(2);
                        mongoAdapter.findOne('unitTests', {a: 1}).then(obj => {
                            expect(obj.b).toBe(3);
                            mongoAdapter.insertOne('unitTests', {a: 2}).then(status => {
                                expect(status.result.ok).toBe(1);
                                mongoAdapter.find('unitTests', {a: 2}).then(objects => {
                                    expect(objects.length).toBe(2);
                                    expect(objects[0].a).toBe(2);
                                    mongoAdapter.updateOne('unitTests', {a: 1}, {a: 1, b: 5}).then(() => {
                                        mongoAdapter.findOne('unitTests', {a: 1}).then(obj => {
                                            expect(obj.b).toBe(5);
                                            mongoAdapter.updateMany('unitTests', {a: {$gt: 1}}, {$set: {c: 6}}).then(() => {
                                                mongoAdapter.find('unitTests', {a: 2}).then(objects => {
                                                    let d = 0;
                                                    let c = 0;
                                                    objects.forEach(obj => {
                                                        d += obj.d | 0;
                                                        c += obj.c | 0;
                                                    });
                                                    expect(d).toBe(1);
                                                    expect(c).toBe(12);
                                                    done();
                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});
