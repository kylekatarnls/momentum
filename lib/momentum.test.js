describe('Momentum', function () {
    beforeEach(function () {
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 20000;
    });
    it('should be available on window', function () {
        expect(typeof Momentum).toBe('function');
    });
    it('should use relative path if no URL provided', function () {
        var momentum = new Momentum();
        expect(momentum.url).toBe('');
    });
    it('should have editable url prefix', function () {
        var momentum = new Momentum();
        expect(momentum.getUrlPrefix()).toBe('/api/mm/');
        momentum.setUrlPrefix('/foo/');
        expect(momentum.getUrlPrefix()).toBe('/foo/');
    });
    it('should expose its AJAX settings', function (done) {
        var momentum = new Momentum('http://localhost:8092');
        momentum.onReady(function () {
            var ajax = momentum.getAjax();
            expect(ajax.jsonToObject('')).toEqual({});
            expect(ajax.jsonToObject('{}')).toEqual({});
            expect(ajax.jsonToObject('<>')).toEqual({});
            expect(ajax.jsonToObject('{"a": "a"}')).toEqual({a: 'a'});
            var error = null;
            try {
                ajax.json('<no-json>');
            } catch (e) {
                error = e + '';
            }
            expect(error).toContain('in <no-json>');
            var MyClass = function () {
                this.a = 2;
            };
            MyClass.prototype.a = 8;
            MyClass.prototype.b = 3;
            MyClass.prototype.c = 4;
            var obj = new MyClass();
            obj.d = 9;
            ajax.get('http://localhost:8092/reflect', obj, function (data) {
                expect(data).toEqual(JSON.stringify({a: '2', d: '9'}));
                expect(ajax.json(data)).toEqual({a: '2', d: '9'});
                ajax.post('http://localhost:8092/reflect', obj, function (data) {
                    expect(data).toEqual(JSON.stringify({a: '2', d: '9'}));
                    done();
                });
            });
        });
    });
    it('can access server API', function (done) {
        var momentum = new Momentum('http://localhost:8092');
        var count = 0;
        var off = momentum.on(function (data) {
            count++;
            expect(typeof data).toBe('object');
            expect(data.status).toBe('success');
            if (count > 1) {
                off();
                expect(count).toBe(2);
                done();
            }
        });
    });
    it('should allow to stop listening', function (done) {
        var momentum = new Momentum('http://localhost:8092');
        var count = 0;
        var off = momentum.on(function () {
            count++;
        });
        off();
        setTimeout(function () {
            expect(count).toBe(0);
            momentum = new Momentum('http://localhost:8092');
            count = 0;
            done();
        }, 2000);
    });
    it('should wait until it\'s ready', function (done) {
        var momentum = new Momentum('http://localhost:8092');
        momentum.setUrlPrefix('/not/found/');
        var count99999999 = 0;
        momentum.onReady(function () {
            count99999999++;
        }).onReady(function () {
            count99999999++;
        });
        momentum = new Momentum('http://localhost:8092');
        var count8092 = 0;
        momentum.onReady(function () {
            count8092++;
        }).onReady(function () {
            count8092++;
        });
        setTimeout(function () {
            expect(count99999999).toBe(0);
            expect(count8092).toBe(2);
            done();
        }, 2000);
    });
});
