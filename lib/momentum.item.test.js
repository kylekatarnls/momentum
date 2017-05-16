describe('Momentum.Item', function () {
    it('should be identified by identity param', function () {
        var collection = new Momentum.Collection(new Momentum());
        function Foo() {
            this.bar = 'foo';
        }
        Foo.prototype.biz = 'bar';
        var identity = new Foo();
        var item = new Momentum.Item(collection, identity, {});
        expect(item.getIdentity()).toEqual({
            bar: 'foo'
        });
    });
});
