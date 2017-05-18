describe('Momentum.Item', function () {
    beforeEach(function () {
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;
    });
    it('should be identified by identity param', function (done) {
        var momentum = new Momentum('http://localhost:8092');
        var isPhantom = ~window.navigator.userAgent.indexOf('Phantom');
        /* istanbul ignore next */
        momentum.setUrlPrefix('/clone' + (isPhantom ? '-ph' : '') + '6/');
        momentum.onReady(function () {
            var collection = new Momentum.Collection(momentum);
            function Foo() {
                this.bar = 'foo';
            }
            Foo.prototype.biz = 'bar';
            var identity = new Foo();
            var item = new Momentum.Item(collection, identity, {});
            expect(item.getIdentity()).toEqual({
                bar: 'foo'
            });
            momentum.quit(function () {
                setTimeout(done, 100);
            });
        });
    });
});
