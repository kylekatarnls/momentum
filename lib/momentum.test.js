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
        var isPhantom = ~window.navigator.userAgent.indexOf('Phantom');
        /* istanbul ignore next */
        momentum.setUrlPrefix('/clone' + (isPhantom ? '-ph' : '') + '4/');
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
                            }, 1000);
                        }, 500);
                    }, 1000);
                    momentum.remove(['rmvtest', {tag: 'tr'}]);
                }, 500);
            });
        });
    });
    it('can access low level server API', function (done) {
        var momentum = new Momentum('http://localhost:8092');
        var isPhantom = ~window.navigator.userAgent.indexOf('Phantom');
        /* istanbul ignore next */
        momentum.setUrlPrefix('/clone' + (isPhantom ? '-ph' : '') + '1/');
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
                momentum.find(['table', {tag: 'tr'}, {tag: 1, _id: 0}, {
                    limit: [1],
                    sort: [{tr: 1}]
                }], function (elements) {
                    expect(elements.result.length).toBe(1);
                    expect(elements.result[0].tag).toBe('tr');
                    momentum.count(['table', {}], function (count) {
                        expect(count.result).toBeGreaterThan(0);
                        momentum.remove(['table', {}], function () {
                            momentum.count(['table', {}], function (count) {
                                expect(count.result).toBe(0);
                                var block = 'block' + Math.random();
                                momentum.insertMany(['table', [
                                    {display: block, tag: 'section'},
                                    {display: block, tag: 'article'}
                                ]], function (response) {
                                    expect(response.result.n).toBe(2);
                                    var div = 'div' + Math.random();
                                    momentum.updateMany(['table',
                                        {display: block},
                                        {$set: {tag: div}}
                                    ], function (response) {
                                        expect(response.result.n).toBe(2);
                                        momentum.count(['table', {tag: div}], function (count) {
                                            expect(count.result).toBe(2);
                                            momentum.quit(function () {
                                                setTimeout(done, 100);
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        };
        var off = momentum.on(function (event) {
            expect(typeof event).toBe('object', 'typeof event');
            expect(typeof event.args).toBe('object', 'typeof event.args');
            expect(event.args[0]).toBe('insert');
            expect(typeof event.args[3]).toBe('object', 'typeof event.args[3]');
            expect(typeof event.args[3].item).toBe('object', 'typeof event.args[3].item');
            expect(event.args[3].item.tag).toBe('tr', 'event.args[3].item.tag');

            momentum.onReady(function () {
                count |= 4;
            });
            off();
            count |= 2;
            momentum.stopListenCollection('table', function () {
                end();
            });
        });
        setTimeout(function () {
            momentum.listenCollection('table', function () {
                momentum.insertOne(['table', {tag: 'tr'}], function () {
                    count |= 1;
                    setTimeout(end, 100);
                });
            });
        }, 200);
    });
    it('can access high level server API', function (done) {
        var momentum = new Momentum('http://localhost:8092');
        var isPhantom = ~window.navigator.userAgent.indexOf('Phantom');
        /* istanbul ignore next */
        momentum.setUrlPrefix('/clone' + (isPhantom ? '-ph' : '') + '2/');
        var dog = 'dog' + Math.random();
        var color = 'brown' + Math.random();
        momentum.onReady(function () {
            momentum.getCollection('animals', function (animals) {
                expect(animals instanceof Momentum.Collection).toBe(true);
                var offCollection = animals.onChange(function (event) {
                    /* istanbul ignore else */
                    if (event.item.name === dog) {
                        offCollection();
                        expect(event.item.name).toBe(dog);
                        var id = event.item._id;
                        momentum.getItem('animals', id, function (dog) {
                            expect(dog instanceof Momentum.Item).toBe(true);
                            expect(dog.getCollection().getName()).toBe('animals');
                            expect(dog.getIdentity()._id).toBe(id);
                            momentum.listenCollection('animals', function () {
                                var calls = {};
                                var offItem = dog.onUpdate(function (event) {
                                    /* istanbul ignore else */
                                    if (event.update && event.update.$set.color === color) {
                                        calls.item = true;
                                        offItem();
                                        dog.stop(end);
                                    }
                                });
                                offCollection = animals.onChange(function (event) {
                                    /* istanbul ignore else */
                                    if (event.update && event.update.$set.color === color) {
                                        calls.collection = true;
                                        offCollection();
                                        animals.stop(end);
                                    }
                                });
                                var offMomentum = momentum.on(function (event) {
                                    /* istanbul ignore else */
                                    if (event.args[3].name === 'update' && !calls.momentum && event.args[3].update.$set.color === color) {
                                        calls.momentum = true;
                                        offMomentum();
                                        expect(event.args[3].update.$set.color).toBe(color);
                                        setTimeout(end, 100);
                                    }
                                });
                                expect(typeof offItem).toBe('function');
                                var quit = function () {
                                    end = /* istanbul ignore next */ function () {
                                    };
                                    expect(calls).toEqual({
                                        item: true,
                                        collection: true,
                                        momentum: true
                                    });
                                    momentum.quit(function () {
                                        setTimeout(done, 100);
                                    });
                                };
                                var timeout = setTimeout(quit, 4000);
                                var end = function () {
                                    /* istanbul ignore else */
                                    if (Object.keys(calls).length === 3) {
                                        clearTimeout(timeout);
                                        quit();
                                    }
                                };
                                setTimeout(function () {
                                    var clone = dog.set({
                                        color: color
                                    }, function (data) {
                                        expect(data.modifiedCount).toBe(1, 'should modify 1 item');
                                    });
                                    expect(clone).toBe(dog);
                                }, 200);
                            });
                        });
                    }
                });
                animals.insertOne({
                    name: dog,
                    color: 'white'
                });
            });
        });
    });
    it('should allow CRUD events to pass to collection', function (done) {
        var momentum = new Momentum('http://localhost:8092');
        var isPhantom = ~window.navigator.userAgent.indexOf('Phantom');
        /* istanbul ignore next */
        momentum.setUrlPrefix('/clone' + (isPhantom ? '-ph' : '') + '3/');
        var group = 'cookie' + Math.random();
        momentum.onReady(function () {
            momentum.getCollection('cookies', function (cookies) {
                expect(cookies instanceof Momentum.Collection).toBe(true);
                var count = 0;
                cookies.onChange(function () {
                    count++;
                });
                cookies.insertMany([
                    {
                        group: group,
                        flavor: 'chocolate'
                    },
                    {
                        group: group,
                        flavor: 'blueberry'
                    }
                ], function (data) {
                    expect(data.insertedCount).toBe(2);
                    setTimeout(function () {
                        var groupCookie = cookies.filter(function (cookie) {
                            return cookie.group === group;
                        });
                        expect(groupCookie.length).toBe(2);
                        expect(count).toBeGreaterThan(0);
                        var countItem = 0;
                        groupCookie[0].onChange(function () {
                            countItem++;
                        });
                        cookies.updateMany({
                            group: group
                        }, {
                            $set: {
                                flavor: 'vanilla'
                            }
                        }, {
                            upsert: true
                        }, function (data) {
                            expect(data.modifiedCount).toBe(2);
                            setTimeout(function () {
                                expect(countItem).toBeGreaterThan(0);
                                cookies.stop(function () {
                                    momentum.quit(function () {
                                        setTimeout(done, 100);
                                    });
                                });
                            }, 1000);
                        });
                    }, 1500);
                });
            });
        });
    });
    it('should allow empty arguments', function () {
        expect(function () {
            var momentum = new Momentum('http://localhost:8092');
            momentum.on()();
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
                                m3.quit(function () {
                                    setTimeout(done, 100);
                                });
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
            momentum.quit(function () {
                setTimeout(done, 100);
            });
        }, 2000);
    });
    it('should get results from filters', function (done) {
        var momentum = new Momentum('http://localhost:8092');

        momentum.onReady(function (data) {
            expect(data).toBe(undefined);
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
                        var off = momentum.on(function (event) {
                            if (matchListen(event, null, id)) {
                                listenItem = event;
                            }
                            if (matchListen(event, 'fruit', null)) {
                                listenCollection = event;
                            }
                        });
                        setTimeout(function () {
                            momentum.updateOne(['counters', {random: random}, {count: 13}], function (data) {
                                expect(data.modifiedCount).toBe(1);
                                setTimeout(function () {
                                    expect(listenItem.args[3].update.count).toBe(13);
                                    expect(listenCollection.args[3].fruit).toBe('banana');
                                    off();
                                    momentum.stopListenItem(collection, id, function () {
                                        momentum.stopListenCollection(collection, 'fruit', function () {
                                            momentum.quit(function () {
                                                setTimeout(done, 100);
                                            });
                                        });
                                    });
                                }, 1500);
                            });
                        }, 500);
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
                m1.connectTimeout = 750;
                m1.onReady(function (error) {
                    expect(error).toEqual(new Error('Connection timeout (750ms) expired'));
                    setTimeout(function () {
                        m1.quit(function () {
                            m2.onReady(function (error) {
                                expect(error).toBe(undefined);
                                m2.quit(function () {
                                    setTimeout(done, 100);
                                });
                            });
                        });
                    }, 100);
                });
            }, 500);
        });
    });
    it('should limit ready waiting to connect timeout', function (done) {
        var momentum = new Momentum('http://localhost:65535');
        momentum.setUrlPrefix('/not/found/');
        momentum.connectTimeout = 750;
        momentum.onReady(function (error) {
            expect(error).toEqual(new Error('Connection timeout (750ms) expired'));
            setTimeout(function () {
                momentum.quit(function () {
                    setTimeout(done, 100);
                });
            }, 100);
        });
    });
});
