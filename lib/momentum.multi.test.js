describe('Momentum', function () {
    beforeEach(function () {
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;
    });
    it('should send events between multiple users', function (done) {
        var createClient = function () {
            var momentum = new Momentum('http://localhost:8092');
            var isPhantom = ~window.navigator.userAgent.indexOf('Phantom');
            /* istanbul ignore next */
            momentum.setUrlPrefix('/multi' + (isPhantom ? '-ph' : '') + '1/');

            return momentum;
        };
        var wait = function (delay, callback) {
            return function () {
                var args = [].slice.call(arguments);
                setTimeout(function () {
                    callback.apply(this, args);
                }, delay);
            };
        };
        var scenario = function (callback) {
            var linusServer = createClient();
            linusServer.onReady(function () {
                var denisServer = createClient();
                denisServer.onReady(function () {
                    linusServer.getCollection('documents', function (linusView) {
                        denisServer.getCollection('documents', function (denisView) {
                            callback(linusView, denisView, function () {
                                linusView.stop(function () {
                                    denisView.stop(function () {
                                        linusServer.quit(function () {
                                            denisServer.quit(wait(100, done));
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        };
        scenario(function (linusView, denisView, end) {
            var code1 = Math.random();
            var code2 = Math.random();
            var firstExists = function (documents) {
                return documents.filter(function (document) {
                        return document.content === 'first';
                    }).length > 0;
            };
            var countAll = function (documents) {
                return documents.filter(function (document) {
                    return document.code === code1 || document.code === code2;
                }).length;
            };
            linusView.insertOne({
                code: code1,
                content: 'first'
            }, wait(400, function () {
                linusView.insertOne({
                    code: code2,
                    content: 'Hello'
                }, wait(400, function () {
                    var index = denisView.map(function (document) {
                        return document.code;
                    }).indexOf(code2);
                    expect(index).toBeGreaterThan(-1);
                    var denisDocument = denisView[index];
                    expect(denisDocument.content).toBe('Hello');
                    denisDocument.set({
                        content: 'Bye'
                    }, wait(400, function (data) {
                        expect(data.modifiedCount).toBe(1);
                        var index = linusView.map(function (document) {
                            return document.code;
                        }).indexOf(code2);
                        expect(index).toBeGreaterThan(-1);
                        var linusDocument = linusView[index];
                        expect(linusDocument.content).toBe('Bye');
                        linusDocument.remove(wait(400, function (data) {
                            expect(data.result.n).toBe(1);
                            expect(denisDocument.isRemoved()).toBe(true);
                            expect(firstExists(denisView)).toBe(true);
                            expect(firstExists(linusView)).toBe(true);
                            expect(countAll(denisView)).toBe(1);
                            expect(countAll(linusView)).toBe(1);
                            end();
                        }));
                    }));
                }));
            }));
        });
    });
    it('should synchronize item between multiple users', function (done) {
        var createClient = function () {
            var momentum = new Momentum('http://localhost:8092');
            var isPhantom = ~window.navigator.userAgent.indexOf('Phantom');
            /* istanbul ignore next */
            momentum.setUrlPrefix('/multi' + (isPhantom ? '-ph' : '') + '2/');

            return momentum;
        };
        var wait = function (delay, callback) {
            return function () {
                var args = [].slice.call(arguments);
                setTimeout(function () {
                    callback.apply(this, args);
                }, delay);
            };
        };
        var scenario = function (callback) {
            var linusServer = createClient();
            linusServer.onReady(function () {
                var denisServer = createClient();
                denisServer.onReady(function () {
                    linusServer.getCollection('configm', function (linusView) {
                        denisServer.getCollection('configm', function (denisView) {
                            callback(linusView, denisView, function () {
                                linusView.stop(function () {
                                    denisView.stop(function () {
                                        linusServer.quit(function () {
                                            denisServer.quit(wait(100, done));
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        };
        scenario(function (linusView, denisView, end) {
            var code = Math.random();
            var getConfig = function (configs) {
                return configs.filter(function (config) {
                    return config.code === code;
                });
            };
            var countAll = function (configs) {
                return getConfig(configs).length;
            };
            denisView.onInsert(wait(400, function () {
                expect(countAll(denisView)).toBe(1);
                expect(countAll(linusView)).toBe(1);
                expect(getConfig(linusView)[0].content).toBe('first');
                var denisConfig = getConfig(denisView)[0];
                expect(denisConfig.content).toBe('first');
                var itemCallbackCalled = 0;
                var momentum = createClient();
                getConfig(linusView)[0].onRemove(wait(800, function (event) {
                    /* istanbul ignore else */
                    if (event.filter._id === id) {
                        expect(countAll(denisView)).toBe(0);
                        expect(countAll(linusView)).toBe(0);
                        expect(itemCallbackCalled).toBe(3);
                        momentum.quit(wait(800, end));
                    }
                }));
                var id = denisConfig._id;
                momentum.onReady(function () {
                    momentum.listenItem('configm', id, function () {
                        momentum.on(function (event) {
                            /* istanbul ignore else */
                            if (event.listen.collection === 'configm' && event.listen.id === id) {
                                itemCallbackCalled |= 2;
                            }
                        });
                        momentum.getItem('configm', id, function (config) {
                            config.onRemove(function () {
                                itemCallbackCalled |= 1;
                            });
                            denisConfig.remove();
                        });
                    });
                });
            }));
            linusView.insertOne({
                code: code,
                content: 'first'
            });
        });
    });
});
