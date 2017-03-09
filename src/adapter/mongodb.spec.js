const MongodbAdapter = require('./mongodb');

describe('MongodbAdapter', () => {
    it('must be compatible only with mongodb', () => {
        expect(MongodbAdapter.isCompatible('mongodb://foo')).toBe(true);
        expect(MongodbAdapter.isCompatible('mysql://foo')).toBe(false);
    });
    it('must be have the url property set to the input', () => {
        const mongoAdapter = new MongodbAdapter('mongodb://localhost:27017/momentum');
        expect(mongoAdapter.url).toBe('mongodb://localhost:27017/momentum');
    });
    it('must throw an exception if collection name is wrong', () => {
        const mongoAdapter = new MongodbAdapter('mongodb://localhost:27017/momentum');
        expect(() => mongoAdapter.getCollection(null)).toThrow(new Error('Collection name must be a non-empty string'));
    });
    it('must reject if start failed', (done) => {
        const mongoAdapter = new MongodbAdapter('mongodb://999.999.999.999:999/momentum');
        let error = null;
        mongoAdapter.start().catch(err => {
            error = err;

            return err;
        }).then(() => {
            expect(error + '').toBe('MongoError: failed to connect to server [999.999.999.999:999] on first connect');
            done();
        });
    });
    it('must store and get elements', (done) => {
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
                                mongoAdapter.find('unitTests', {a: 2}).toArray((err, objs) => {
                                    expect(err).toBe(null);
                                    expect(objs.length).toBe(2);
                                    expect(objs[0].a).toBe(2);
                                    mongoAdapter.updateOne('unitTests', {a: 1}, {a: 1, b: 5}).then(() => {
                                        mongoAdapter.findOne('unitTests', {a: 1}).then(obj => {
                                            expect(obj.b).toBe(5);
                                            mongoAdapter.updateMany('unitTests', {a: {$gt: 1}}, {$set: {c: 6}}).then(() => {
                                                mongoAdapter.find('unitTests', {a: 2}).toArray((err, objs) => {
                                                    expect(err).toBe(null);
                                                    let d = 0;
                                                    let c = 0;
                                                    objs.forEach(obj => {
                                                        if (obj.d) {
                                                            d += obj.d;
                                                        }
                                                        if (obj.a) {
                                                            c += obj.c;
                                                        }
                                                    });
                                                    expect(d).toBe(1);
                                                    expect(c).toBe(12);
                                                    done();
                                                });
                                            });
                                        });
                                    });
                                })
                            })
                        })
                    });
                });
            });
        });
    });
});

/*
 class MongodbAdapter extends AdapterInterface {
 updateMany(collection, ...args) {
 return this.getCollection(collection).updateMany(...args);
 }

 remove(collection, ...args) {
 return this.getCollection(collection).remove(...args);
 }
 }
 */
