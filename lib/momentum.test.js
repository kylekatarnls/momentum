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
                ajax.json('< no-json >');
            } catch (e) {
                error = e + '';
            }
            expect(error).toContain('in < no-json >');
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
                    ajax.postJson('http://localhost:8092/reflect', obj, function (data) {
                        expect(data).toEqual(JSON.stringify({a: 2, d: 9}));
                        done();
                    });
                });
            });
        });
    });
    it('can access server API', function (done) {
        var momentum = new Momentum('http://localhost:8092');
        var count = 0;
        var off = momentum.on(function (data) {
            momentum.onReady(function () {
                count += 4;
            });
            off();
            count += 2;
            expect(typeof data).toBe('object', 'typeof data');
            expect(typeof data.events).toBe('object', 'typeof data.events');
            expect(typeof data.events[0]).toBe('object', 'typeof data.events[0]');
            expect(typeof data.events[0].args).toBe('object', 'typeof data.events[0].args');
            expect(data.events[0].args[0]).toBe('insert');
            expect(typeof data.events[0].args[4]).toBe('object', 'typeof data.events[0].args[4]');
            expect(data.events[0].args[4].tag).toBe('tr', 'data.events[0].args[4].tag');
            expect(count).toBe(7);
            done();
        });
        setTimeout(function () {
            momentum.listenCollection('table', function () {
                momentum.insertOne(['table', {tag: 'tr'}], function () {
                    count++;
                });
            });
        }, 200);
    });
    it('should allow empty arguments', function () {
        expect(function () {
            var momentum = new Momentum('http://localhost:8092');
            momentum.on();
            momentum.onReady();
            momentum.listenItem();
            momentum.updateOne();
        }).not.toThrowError();
    });
    // it('can access server API', function (done) {
    //     var momentum = new Momentum('http://localhost:8092');
    //     momentum.onReady(function () {
    //         var count = 0;
    //         var off = momentum.on(function () {
    //             /* istanbul ignore next */
    //             count++;
    //         });
    //         off();
    //         setTimeout(function () {
    //             expect(count).toBe(0);
    //             done();
    //         }, 2000);
    //     });
    // });
    // it('should allow to stop listening', function (done) {
    //     var momentum = new Momentum('http://localhost:8092');
    //     var count = 0;
    //     var off = momentum.on(function () {
    //         /* istanbul ignore next */
    //         count++;
    //     });
    //     off();
    //     setTimeout(function () {
    //         expect(count).toBe(0);
    //         done();
    //     }, 2000);
    // });
    it('should wait until it\'s ready', function (done) {
        var momentum = new Momentum('http://localhost:65535');
        var self = momentum.setUrlPrefix('/not/found/');
        expect(self).toBe(momentum);
        var inc = function () {
            this.count++;
        };

        var count65535 = {count: 0};
        momentum
            .onReady(inc.bind(count65535))
            .onReady(inc.bind(count65535));

        momentum = new Momentum('http://localhost:8092');
        var count8092 = {count: 0};
        momentum
            .onReady(inc.bind(count8092))
            .onReady(inc.bind(count8092));
        setTimeout(function () {
            expect(count65535.count).toBe(0);
            expect(count8092.count).toBe(2);
            done();
        }, 2000);
    });
});
