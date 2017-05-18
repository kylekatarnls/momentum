describe('Momentum', function () {
    beforeEach(function () {
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;
    });
    it('should send events between multiple users', function (done) {
        var createClient = function () {
            var momentum = new Momentum('http://localhost:8092');
            momentum.setUrlPrefix('/multi/');

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
});
