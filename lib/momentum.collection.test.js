describe('Momentum.Collection', function () {
    it('should extends array behaviour', function () {
        var collection = new Momentum.Collection(new Momentum());
        expect(collection.length).toBe(0);
        collection.push({foo: 'bar'});
        expect(collection.length).toBe(1);
    });
    it('should have hasId method', function () {
        var collection = new Momentum.Collection(new Momentum(), 'foo', [
            {
                _id: 'foo'
            }
        ]);
        expect(collection.hasId('bar')).toBe(false);
        expect(collection.hasId('foo')).toBe(true);
    });
    it('should have isolated listener', function (done) {
        var momentum = new Momentum('http://localhost:8092');
        momentum.onReady(function () {
            var collection = 'foo' + Math.random();
            momentum.getCollection(collection, function (foo) {
                var count = 0;
                foo.onChange(function () {
                    count++;
                });
                momentum.trigger([
                    {
                        args: [],
                        listen: {
                            collection: collection,
                            filter: 'filter'
                        }
                    },
                    {
                        args: [],
                        listen: {
                            collection: collection
                        }
                    }
                ]);
                expect(count).toBe(1);
                done();
            });
        });
    });
});
