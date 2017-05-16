describe('Momentum.Collection', function () {
    it('should extends array behaviour', function () {
        var collection = new Momentum.Collection(new Momentum('http://localhost:8092'));
        expect(collection.length).toBe(0);
        collection.push({foo: 'bar'});
        expect(collection.length).toBe(1);
    });
    it('should have hasId method', function () {
        var collection = new Momentum.Collection(new Momentum('http://localhost:8092'), 'foo', [
            {
                _id: 'foo'
            }
        ]);
        expect(collection.hasId('bar')).toBe(false);
        expect(collection.hasId('foo')).toBe(true);
    });
});
