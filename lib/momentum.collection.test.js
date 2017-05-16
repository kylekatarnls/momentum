describe('Momentum.Collection', function () {
    beforeEach(function () {
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 20000;
    });
    it('should extends array behaviour', function (done) {
        var momentum = new Momentum('http://localhost:8092');
        momentum.setUrlPrefix('/clone6/');
        var collection = new Momentum.Collection(momentum);
        expect(collection.length).toBe(0);
        collection.push({foo: 'bar'});
        expect(collection.length).toBe(1);
        momentum.quit(done);
    });
    it('should have hasId method', function (done) {
        var momentum = new Momentum('http://localhost:8092');
        momentum.setUrlPrefix('/clone6/');
        var collection = new Momentum.Collection(momentum, 'foo', [
            {
                _id: 'foo'
            }
        ]);
        expect(collection.hasId('bar')).toBe(false);
        expect(collection.hasId('foo')).toBe(true);
        momentum.quit(done);
    });
    it('should have isolated listener', function (done) {
        var momentum = new Momentum('http://localhost:8092');
        momentum.setUrlPrefix('/clone7/');
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
                momentum.quit(done);
            });
        });
    });
});
