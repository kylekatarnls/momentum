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
                setTimeout(callback, delay);
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
            var code = Math.random();
            linusView.insertOne({
                code: code,
                content: 'Hello'
            }, wait(800, function () {
                var index = denisView.map(function (document) {
                    return document.code;
                }).indexOf(code);
                expect(index).toBeGreaterThan(-1);
                var denisDocument = denisView[index];
                expect(denisDocument.content).toBe('Hello');
                denisDocument.set({
                    content: 'Bye'
                }, wait(800, function () {
                    var index = linusView.map(function (document) {
                        return document.code;
                    }).indexOf(code);
                    expect(index).toBeGreaterThan(-1);
                    var linusDocument = linusView[index];
                    expect(linusDocument.content).toBe('Bye');
                    linusDocument.remove(wait(400, function () {
                        expect(denisDocument.isRemoved()).toBe(true);
                        end();
                    }));
                }));
            }));
        });
    });
});
