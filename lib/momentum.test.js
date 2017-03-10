describe('Momentum', function () {
    it('should be available on window', function () {
        expect(typeof Momentum).toBe('function');
    });
    it('can access server API', function (done) {
        momentum = new Momentum('http://localhost:8092');
        momentum.on(function (data) {
            expect(typeof data).toBe('object');
            expect(data.status).toBe('success');
            done();
        });
    });
});
