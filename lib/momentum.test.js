describe('Momentum', function () {
    beforeEach(function () {
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;
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
            var value = 1;
            ajax.jsonCallback(null, function (input) {
                value = input;
            });
            expect(value).toBe(null);
            value = 1;
            ajax.jsonCallback('{"a":4}', function (input) {
                value = input;
            });
            expect(value).toEqual({a: 4});
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
    it('should allow onReady to be cancelled', function (done) {
        var momentum = new Momentum('http://localhost:8092');
        momentum.onReady(function () {
            momentum.listenCollection('rmvtest', function () {
                var test = {
                    method1: /* istanbul ignore next */ function () {
                    },
                    method2: /* istanbul ignore next */ function () {
                    }
                };
                spyOn(test, 'method1');
                spyOn(test, 'method2');
                var off1 = momentum.on(test.method1);
                var off2 = momentum.on(test.method2);
                off1();
                off2();
                setTimeout(function () {
                    setTimeout(function () {
                        expect(test.method1).not.toHaveBeenCalled();
                        expect(test.method2).not.toHaveBeenCalled();
                        momentum.on(test.method1);
                        momentum.on(test.method2);
                        setTimeout(function () {
                            momentum.remove(['rmvtest', {tag: 'tr'}]);
                            setTimeout(function () {
                                expect(test.method1).toHaveBeenCalled();
                                expect(test.method2).toHaveBeenCalled();
                                momentum.stopListenCollection('rmvtest', function () {
                                    momentum.quit(done);
                                });
                            }, 750);
                        }, 250);
                    }, 750);
                    momentum.remove(['rmvtest', {tag: 'tr'}]);
                }, 250);
            });
        });
    });
    it('can access low level server API', function (done) {
        var momentum = new Momentum('http://localhost:8092');
        var count = 0;
        var first = true;
        var end = function () {
            if (first) {
                first = false;

                return;
            }

            expect(count).toBe(7);
            momentum.findOne(['table', {tag: 'tr'}], function (element) {
                expect(element.result.tag).toBe('tr');
                momentum.find(['table', {tag: 'tr'}, {tag: 1, _id: 0}, {limit: [1], sort: [{tr: 1}]}], function (elements) {
                    expect(elements.result.length).toBe(1);
                    expect(elements.result[0].tag).toBe('tr');
                    momentum.count(['table', {}], function (count) {
                        expect(count.result).toBeGreaterThan(0);
                        momentum.remove(['table', {}], function () {
                            momentum.count(['table', {}], function (count) {
                                expect(count.result).toBe(0);
                                momentum.insertMany(['table', [
                                    {display: 'block', tag: 'section'},
                                    {display: 'block', tag: 'article'}
                                ]], function (response) {
                                    expect(response.result.n).toBe(2);
                                    momentum.updateMany(['table',
                                        {display: 'block'},
                                        {$set: {tag: 'div'}}
                                    ], function (response) {
                                        expect(response.result.n).toBe(2);
                                        momentum.count(['table', {tag: 'div'}], function (count) {
                                            expect(count.result).toBe(2);
                                            momentum.quit(done);
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        };
        var off = momentum.on(function (events) {
            expect(typeof events).toBe('object', 'typeof events');
            expect(typeof events[0]).toBe('object', 'typeof events[0]');
            expect(typeof events[0].args).toBe('object', 'typeof events[0].args');
            expect(events[0].args[0]).toBe('insert');
            expect(typeof events[0].args[3]).toBe('object', 'typeof events[0].args[3]');
            expect(typeof events[0].args[3].item).toBe('object', 'typeof events[0].args[3].item');
            expect(events[0].args[3].item.tag).toBe('tr', 'events[0].args[3].item.tag');

            momentum.onReady(function () {
                count += 4;
            });
            off();
            count += 2;
            momentum.stopListenCollection('table', function () {
                end();
            });
        });
        setTimeout(function () {
            momentum.listenCollection('table', function () {
                momentum.insertOne(['table', {tag: 'tr'}], function () {
                    count++;
                    end();
                });
            });
        }, 200);
    });
    it('can access high level server API', function (done) {
        var momentum = new Momentum('http://localhost:8092');
        momentum.onReady(function () {
            momentum.getCollection('animals', function (animals) {
                animals.onChange(function (event) {
                    expect(event.item.foo).toBe('bar');
                    done();
                });
                animals.insertOne({
                    foo: 'bar'
                });
            });
        });
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
    it('should disallow too many connection', function (done) {
        var restrictedMomentum = function () {
            var momentum = new Momentum('http://localhost:8092');
            momentum.setUrlPrefix('/restricted/');

            return momentum;
        };
        var m1 = restrictedMomentum();
        m1.onReady(function (error) {
            expect(error).toBe(undefined);
            var m2 = restrictedMomentum();
            m2.onReady(function (error) {
                expect(error).toBe(undefined);
                var m3 = restrictedMomentum();
                var test = {
                    method: /* istanbul ignore next */ function () {
                    }
                };
                spyOn(test, 'method');
                var off = m3.on(test.method);
                m3.onReady(function (error) {
                    expect(typeof error).toBe('object');
                    expect(error instanceof Error).toBe(true);
                    expect(error).toEqual(new Error('Too many connections'));
                    setTimeout(function () {
                        expect(off).not.toThrowError();
                        expect(test.method).not.toHaveBeenCalled();
                        m1.quit(function () {
                            m2.quit(function () {
                                m3.quit(done);
                            });
                        });
                    }, 100);
                });
            });
        });
    });
    it('should allow to stop listening', function (done) {
        var momentum = new Momentum('http://localhost:8092');
        var count = 0;
        /* istanbul ignore next */
        var off = momentum.on(function () {
            /* istanbul ignore next */
            count++;
        });
        off();
        setTimeout(function () {
            expect(count).toBe(0);
            momentum.quit(done);
        }, 2000);
    });
    it('should get results from filters', function (done) {
        var momentum = new Momentum('http://localhost:8092');

        momentum.onReady(function () {
            var collection = 'counters';
            var random = Math.random();
            momentum.insertOne([collection, {count: 0, random: random}], function (data) {
                expect(typeof data).toBe('object', 'typeof data.args');
                expect(typeof data.args).toBe('object', 'typeof data.args');
                var id = data.args[2];
                var listenItem = null;
                var listenCollection = null;
                var matchListen = function (event, filter, id) {
                    var listen = event.listen;

                    return event.args[0].indexOf('update') === 0 &&
                        event.args[3].item.random === random &&
                        listen.collection === collection &&
                        listen.filter === filter &&
                        listen.id === id;
                };
                momentum.listenItem(collection, id, function () {
                    momentum.listenCollection(collection, 'fruit', function () {
                        var off = momentum.on(function (events) {
                            expect(typeof events).toBe('object', 'typeof events');
                            expect(typeof events[0]).toBe('object', 'typeof events[0]');
                            events.forEach(function (event) {
                                if (matchListen(event, null, id)) {
                                    listenItem = event;
                                }
                                if (matchListen(event, 'fruit', null)) {
                                    listenCollection = event;
                                }
                            });
                        });
                        setTimeout(function () {
                            momentum.updateOne(['counters', {random: random}, {count: 13}]);
                            setTimeout(function () {
                                expect(listenItem.args[3].update.count).toBe(13);
                                expect(listenCollection.args[3].fruit).toBe('banana');
                                off();
                                momentum.stopListenItem(collection, id, function () {
                                    momentum.stopListenCollection(collection, 'fruit', function () {
                                        momentum.quit(done);
                                    });
                                });
                            }, 1000);
                        }, 1000);
                    });
                });
            });
        });
    });
    it('should wait until it\'s ready', function (done) {
        var m1 = new Momentum('http://localhost:65535');
        var self = m1.setUrlPrefix('/not/found/');
        expect(self).toBe(m1);
        var inc = function () {
            this.count++;
        };

        var count65535 = {count: 0};
        m1.onReady(inc.bind(count65535)).onReady(inc.bind(count65535));

        var m2 = new Momentum('http://localhost:8092');
        var count8092 = {count: 0};
        m2.onReady(inc.bind(count8092)).onReady(inc.bind(count8092));
        m2.onReady(function () {
            setTimeout(function () {
                expect(count65535.count).toBe(0);
                expect(count8092.count).toBe(2);
                m1.quit(function () {
                    m2.quit(done);
                });
            }, 500);
        });
    });
});
