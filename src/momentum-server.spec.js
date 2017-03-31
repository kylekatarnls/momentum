const AdapterInterface = require('./adapter/interface');
const MomentumServer = require('./momentum-server');

const emulateApp = () => ({
    token: null,
    getRoutes: {},
    postRoutes: {},
    lastResponse: null,
    get(route, callback) {
        this.getRoutes[route] = callback;
    },
    post(route, ...callbacks) {
        this.postRoutes[route] = callbacks.pop();
    },
    getLastResponse() {
        return this.lastResponse;
    },
    call(method, route, body = {}) {
        body.token = this.token;
        const app = this;

        return new Promise(resolve => {
            this.lastResponse = {
                status() {
                    return this;
                },
                json(data) {
                    data = JSON.parse(JSON.stringify(data));
                    if (data.token) {
                        app.token = data.token;
                    }

                    resolve(data);

                    return this;
                }
            };
            this[method + 'Routes'][route]({
                setTimeout() {
                },
                headers: {},
                connection: {
                    remoteAddress: '127.0.0.1'
                },
                body,
                query: body
            }, this.lastResponse);
        });
    }
});

class FoobarAdapter extends AdapterInterface {
    static isCompatible(url) {
        return url.indexOf('foo:') === 0;
    }

    start() {
        return new Promise(resolve => {
            resolve(true);
        });
    }

    stop() {
    }

    //noinspection JSMethodCanBeStatic
    getBar() {
        return 42;
    }

    find() {
        return new Promise((resolve, reject) => {
            reject('fake-error');
        });
    }
}

describe('MomentumServer', () => {
    afterAll(done => {
        MomentumServer.connect(emulateApp(), 'mongodb://localhost:27017/momentum').then(momentum => {
            const collections = [
                'aatokens',
                'config',
                'counters',
                'magicans',
                'people',
                'table',
                'unitTests'
            ];
            let count = collections.length;
            collections.forEach(collection => {
                momentum.remove(collection, {}).then(() => {
                    if (--count < 1) {
                        momentum.stop().then(done);
                    }
                });
            });
        });
    });
    it('should invalidate tokens on invalidateTokens call', done => {
        MomentumServer.connect(8092, 'mongodb://localhost:27017/momentum').then(momentum => {
            const prefix = 'aa';
            const ip = 'bb';
            const tokens = prefix + 'tokens';
            momentum.options.collectionPrefix = prefix;
            momentum.insertOne(tokens, {ip}).then(() => {
                momentum.count(tokens, {ip}).then(count => {
                    expect(count).toBe(1);
                    momentum.invalidateTokens({ip: {$in: [ip, '127.0.0.1']}}).then(() => {
                        momentum.count(tokens, {ip}).then(count => {
                            expect(count).toBe(0);
                            momentum.stop().then(done);
                        });
                    });
                });
            });
        });
    });
    it('should start successfully with mongodb', done => {
        const momentum = new MomentumServer('mongodb://localhost:27017/momentum');

        momentum.adapter.start().then(() => {
            const bob = {
                name: 'Bob',
                date: new Date()
            };
            momentum.adapter.insertOne('users', bob).then(() => {
                momentum.adapter.find('users', {}).sort({date: -1}).limit(1).then(users => {
                    expect(users.length).toBe(1);
                    expect(users[0].name).toBe('Bob');
                    momentum.adapter.stop().then(done);
                });
            });
        });
    });
    it('should have null adapter with wrong arguments', done => {
        const momentum = new MomentumServer('foobar');
        momentum.stop().then(() => {
            setTimeout(done, 1);
        });

        expect(momentum.adapter).toBe(null);
    });
    it('should have an editable url prefix', () => {
        const momentum = new MomentumServer('foobar');
        expect(momentum.getUrlPrefix()).toBe('/api/mm/');
        momentum.setUrlPrefix('/mm/api/');
        expect(momentum.getUrlPrefix()).toBe('/mm/api/');
    });
    it('should have an editable authorization strategy', done => {
        const momentum = new MomentumServer('foobar');
        momentum.isAllowed('a').then(allowed => {
            expect(allowed).toBe(true);
            momentum.isAllowed('b').then(allowed => {
                expect(allowed).toBe(true);
                momentum.setAuthorizationStrategy(method => {
                    return new Promise(resolve => {
                        resolve(method === 'a');
                    });
                });
                momentum.isAllowed('a').then(allowed => {
                    expect(allowed).toBe(true);
                    momentum.isAllowed('b').then(allowed => {
                        expect(allowed).toBe(false);
                        done();
                    });
                });
            });
        });
    });
    it('should handle custom adapter', () => {
        MomentumServer.addAdapter('foobar', FoobarAdapter);
        const momentum = new MomentumServer('foo:bar');

        expect(momentum.adapter.getBar()).toBe(42);
    });
    it('should be able to link to an app', () => {
        const momentum = new MomentumServer('mongodb://localhost:27017/momentum');
        momentum.linkApplication({a: 42});

        expect(momentum.linkedApp.a).toBe(42);
    });
    it('should listen the /on route', done => {
        const momentum = new MomentumServer('mongodb://localhost:27017/momentum');
        const app = emulateApp();
        momentum.start(app).then(() => {
            app.call('get', '/api/mm/ready').then(result => {
                expect(typeof result).toBe('object');
                expect(result.status).toBe('success');
                app.call('get', '/api/mm/on').then(result => {
                    expect(typeof result).toBe('object');
                    expect(typeof result.events).toBe('object');
                    expect(typeof result.events[0]).toBe('object');
                    expect(typeof result.events[0].args).toBe('object');
                    expect(result.events[0].args[1]).toBe('insertOne');
                    expect(typeof result.events[0].args[4]).toBe('object');
                    expect(result.events[0].args[4].a).toBe(1);
                    momentum.stop().then(done);
                });
                setTimeout(() => {
                    app.call('post', '/api/mm/listen', {
                        collection: 'config'
                    }).then(result => {
                        expect(typeof result).toBe('object');
                        expect(result.status).toBe('success');
                        app.call('post', '/api/mm/emit', {
                            method: 'insertOne',
                            args: ['config', {a: 1}]
                        }).then(result => {
                            expect(typeof result).toBe('object');
                            expect(result.ok).toBe(1);
                        });
                    });
                }, 500);
            });
        });
    });
    it('should call back the /on route only if response not already sent', done => {
        const momentum = new MomentumServer('mongodb://localhost:27017/momentum');
        const app = emulateApp();
        momentum.start(app).then(() => {
            app.call('get', '/api/mm/ready').then(result => {
                expect(typeof result).toBe('object');
                expect(result.status).toBe('success');
                let count = 0;
                const inc = () => {
                    count++;
                };
                app.call('get', '/api/mm/on').then(inc);
                setTimeout(() => {
                    const response = app.getLastResponse();
                    app.call('post', '/api/mm/listen', {
                        collection: 'config'
                    }).then(result => {
                        expect(typeof result).toBe('object');
                        expect(result.status).toBe('success');
                        response.headersSent = true;
                        app.call('post', '/api/mm/emit', {
                            method: 'insertOne',
                            args: ['config', {a: 'bad'}]
                        }).then(() => {
                            setTimeout(() => {
                                inc();
                                expect(count).toBe(1);
                                momentum.stop().then(done);
                            }, 500);
                        });
                    });
                }, 500);
            });
        });
    });
    it('should group /on calls when close in time', done => {
        const momentum = new MomentumServer('mongodb://localhost:27017/momentum');
        const app = emulateApp();
        momentum.start(app).then(() => {
            app.call('get', '/api/mm/ready').then(result => {
                expect(typeof result).toBe('object');
                expect(result.status).toBe('success');
                app.call('get', '/api/mm/on').then(result => {
                    expect(typeof result).toBe('object');
                    expect(typeof result.events).toBe('object');
                    expect(typeof result.events[0]).toBe('object');
                    expect(typeof result.events[0].args).toBe('object');
                    expect(result.events.length).toBe(2);
                    expect(result.events[0].args[1]).toBe('insertOne');
                    expect(typeof result.events[0].args[4]).toBe('object');
                    expect(result.events[0].args[4].a).toBe(1);
                    expect(typeof result.events[1]).toBe('object');
                    expect(typeof result.events[1].args).toBe('object');
                    expect(result.events[1].args[1]).toBe('insertOne');
                    expect(typeof result.events[1].args[4]).toBe('object');
                    expect(result.events[1].args[4].a).toBe(2);
                    momentum.stop().then(done);
                });
                setTimeout(() => {
                    app.call('post', '/api/mm/listen', {
                        collection: 'config'
                    }).then(result => {
                        expect(typeof result).toBe('object');
                        expect(result.status).toBe('success');
                        app.call('post', '/api/mm/emit', {
                            method: 'insertOne',
                            args: ['config', {a: 1}]
                        });
                        setTimeout(() => {
                            app.call('post', '/api/mm/emit', {
                                method: 'insertOne',
                                args: ['config', {a: 2}]
                            });
                        }, 50);
                    });
                }, 500);
            });
        });
    });
    it('should handle errors on /emit route', done => {
        const momentum = new MomentumServer('mongodb://localhost:27017/momentum');
        const app = emulateApp();
        momentum.start(app).then(() => {
            app.call('post', '/api/mm/emit', {
                method: 'insertFoo',
                args: ['config', {a: 1}]
            }).then(result => {
                expect(typeof result).toBe('object');
                expect(result.error).toBe('insertFoo method unknown');
                app.call('post', '/api/mm/emit', {
                    method: 'insertOne',
                    args: []
                }).then(result => {
                    expect(typeof result).toBe('object');
                    expect(result.error).toEqual('Arguments cannot be empty');
                    momentum.stop().then(done);
                });
            });
        });
    });
    it('should handle authorization strategy', done => {
        const momentum = new MomentumServer('mongodb://localhost:27017/momentum');
        const app = emulateApp();
        momentum.setAuthorizationStrategy((mode, method, args) => {
            return !args[1].voldemort;
        });
        momentum.start(app).then(() => {
            app.call('post', '/api/mm/emit', {
                method: 'insertOne',
                args: ['magicians', {voldemort: 1}]
            }).then(result => {
                expect(typeof result).toBe('object');
                expect(result.error).toBe('insertOne not allowed with ["magicians",{"voldemort":1}]');
                momentum.stop().then(done);
            });
        });
    });
    it('should handle db errors', done => {
        const momentum = new MomentumServer('mongodb://localhost:27017/momentum');
        const app = emulateApp();
        momentum.start(app).then(() => {
            momentum.remove('magicians', {name: 'Harry'}).then(() => {
                const harry = {name: 'Harry'};
                momentum.insertOne('magicians', harry).then(() => {
                    app.call('post', '/api/mm/emit', {
                        method: 'insertOne',
                        args: ['magicians', harry]
                    }).then(result => {
                        expect(typeof result).toBe('object');
                        expect(result.error.message).toContain('duplicate');
                        momentum.remove('magicians', {name: 'Harry'}).then(() => {
                            momentum.stop().then(done);
                        });
                    });
                });
            });
        });
    });
    it('should wait for ready on the /ready route', done => {
        const momentum = new MomentumServer('mongodb://localhost:27017/momentum');
        const app = emulateApp();
        let outsideCalled = false;
        momentum.start(app).then(() => {
            app.call('get', '/api/mm/ready').then(() => {
                setTimeout(() => {
                    expect(outsideCalled).toBe(true);
                    momentum.stop().then(done);
                }, 200);
            });
        });
        app.call('get', '/api/mm/ready').then(() => {
            outsideCalled = true;
        });
    });
    it('should wait until timeout', done => {
        const momentum = new MomentumServer('mongodb://localhost:27017/momentum');
        momentum.options.timeOut = 500;
        const app = emulateApp();
        momentum.start(app).then(() => {
            app.call('get', '/api/mm/on').then(result => {
                expect(typeof result).toBe('object');
                expect(result.events).toEqual([]);
                momentum.stop().then(done);
            });
        });
    });
    it('should check token', done => {
        const momentum = new MomentumServer('mongodb://localhost:27017/momentum');
        const app = emulateApp();
        momentum.start(app).then(() => {
            app.call('get', '/api/mm/ready').then(() => {
                app.token = 'wrong';
                app.call('post', '/api/mm/listen', {
                    collection: 'foo'
                }).then(result => {
                    expect(typeof result).toBe('object');
                    expect(result.error).toBe('Invalid token wrong');
                    momentum.stop().then(done);
                });
            });
        });
    });
    it('should check token on re-listen if changed', done => {
        const momentum = new MomentumServer('mongodb://localhost:27017/momentum');
        const app = emulateApp();
        momentum.options.timeOut = 400;
        momentum.start(app).then(() => {
            app.call('get', '/api/mm/ready').then(() => {
                app.call('post', '/api/mm/listen', {
                    collection: 'foo',
                    id: '123'
                }).then(result => {
                    expect(typeof result).toBe('object');
                    expect(result.status).toBe('success');
                    setTimeout(() => {
                        const token = app.token;
                        app.token = 'wrong';
                        app.call('post', '/api/mm/listen', {
                            collection: 'foo',
                            id: '123'
                        }).then(result => {
                            expect(typeof result).toBe('object');
                            expect(result.error).toBe('Invalid token wrong');
                            app.token = token;
                            app.call('post', '/api/mm/listen/stop', {
                                id: '123'
                            }).then(result => {
                                expect(typeof result).toBe('object');
                                expect(result.error).toBe('Missing collection name');
                                app.call('get', '/api/mm/quit').then(result => {
                                    expect(typeof result).toBe('object');
                                    expect(result.status).toBe('success');
                                    setTimeout(() => {
                                        app.call('post', '/api/mm/listen/stop', {
                                            collection: 'foo',
                                            id: '123'
                                        }).then(result => {
                                            expect(typeof result).toBe('object');
                                            expect(result.error).toBe('Invalid token ' + token);
                                            momentum.stop().then(done);
                                        });
                                    }, 200);
                                });
                            });
                        });
                    }, 800);
                });
            });
        });
    });
    it('should check if quited before re-listen', done => {
        const momentum = new MomentumServer('mongodb://localhost:27017/momentum');
        const app = emulateApp();
        momentum.options.timeOut = 400;
        momentum.start(app).then(() => {
            app.call('get', '/api/mm/ready').then(() => {
                app.call('post', '/api/mm/listen', {
                    collection: 'foo',
                    id: '123'
                }).then(result => {
                    expect(typeof result).toBe('object');
                    expect(result.status).toBe('success');
                    app.call('get', '/api/mm/quit').then(result => {
                        expect(typeof result).toBe('object');
                        expect(result.status).toBe('success');
                        setTimeout(() => {
                            momentum.stop().then(done);
                        }, 800);
                    });
                });
            });
        });
    });
    it('should stop listening on /listen/stop route', done => {
        const momentum = new MomentumServer('mongodb://localhost:27017/momentum');
        const app = emulateApp();
        momentum.options.timeOut = 400;
        momentum.start(app).then(() => {
            app.call('get', '/api/mm/ready').then(() => {
                app.call('post', '/api/mm/listen', {
                    collection: 'foo',
                    id: '123'
                }).then(result => {
                    expect(typeof result).toBe('object');
                    expect(result.status).toBe('success');
                    app.call('post', '/api/mm/listen/stop', {
                        collection: 'foo',
                        id: '123'
                    }).then(result => {
                        expect(typeof result).toBe('object');
                        expect(result.status).toBe('success');
                        app.call('post', '/api/mm/listen', {
                            collection: 'foo'
                        }).then(result => {
                            expect(typeof result).toBe('object');
                            expect(result.status).toBe('success');
                            app.call('post', '/api/mm/listen/stop', {
                                collection: 'foo'
                            }).then(result => {
                                expect(typeof result).toBe('object');
                                expect(result.status).toBe('success');
                                setTimeout(() => {
                                    momentum.stop().then(done);
                                }, 800);
                            });
                        });
                    });
                });
            });
        });
    });
    it('should check token on re-listen if invalidated', done => {
        const momentum = new MomentumServer('mongodb://localhost:27017/momentum');
        const app = emulateApp();
        momentum.options.timeOut = 500;
        momentum.start(app).then(() => {
            app.call('get', '/api/mm/ready').then(result => {
                const token = result.token;
                app.call('post', '/api/mm/listen', {
                    collection: 'foo',
                    id: '123'
                }).then(result => {
                    expect(typeof result).toBe('object');
                    expect(result.status).toBe('success');
                    setTimeout(() => {
                        momentum.invalidateTokens({token}).then(() => {
                            setTimeout(() => {
                                app.call('post', '/api/mm/listen', {
                                    collection: 'foo',
                                    id: '123'
                                }).then(result => {
                                    expect(typeof result).toBe('object');
                                    expect(result.error).toContain('Invalid token ' + token);
                                    app.call('get', '/api/mm/quit').then(result => {
                                        expect(typeof result).toBe('object');
                                        expect(result.error).toContain('Invalid token ' + token);
                                        momentum.stop().then(done);
                                    });
                                });
                            }, 100);
                        });
                    }, 700);
                });
            });
        });
    });
    it('should check token on re-listen if invalidated', done => {
        const momentum = new MomentumServer('mongodb://localhost:27017/momentum');
        const app = emulateApp();
        momentum.options.timeOut = 1000;
        momentum.start(app).then(() => {
            app.call('get', '/api/mm/ready').then(result => {
                const token = result.token;
                app.call('post', '/api/mm/listen', {
                    collection: 'foo',
                    id: '123'
                }).then(result => {
                    expect(typeof result).toBe('object');
                    expect(result.status).toBe('success');
                    setTimeout(() => {
                        momentum.invalidateTokens({});
                        app.call('post', '/api/mm/listen', {
                            collection: 'foo',
                            id: '123'
                        }).then(result => {
                            expect(typeof result).toBe('object');
                            expect(result.error).toContain('Invalid token ' + token);
                            momentum.stop().then(done);
                        });
                    }, 1500);
                });
            });
        });
    });
    it('should allow custom filters', done => {
        const momentum = new MomentumServer('mongodb://localhost:27017/momentum');
        momentum.addFilter('foo', (...args) => {
            return new Promise(resolve => {
                args[0][4].a++;

                resolve(...args);
            });
        });
        const app = emulateApp();
        momentum.start(app).then(() => {
            app.call('get', '/api/mm/ready').then(() => {
                app.call('post', '/api/mm/listen', {
                    collection: 'config',
                    filter: 'bar'
                }).then(result => {
                    expect(result.error).toBe('Unknown filter bar');
                    app.call('post', '/api/mm/listen', {
                        filter: 'foo'
                    }).then(result => {
                        expect(result.error).toBe('Missing collection name');
                        app.call('get', '/api/mm/on').then(result => {
                            expect(result.events[0].args[4].a).toBe(2);
                            momentum.stop().then(done);
                        });
                        setTimeout(() => {
                            app.call('post', '/api/mm/listen', {
                                collection: 'config',
                                filter: 'foo'
                            });
                            app.call('post', '/api/mm/emit', {
                                method: 'insertOne',
                                args: ['config', {a: 1}]
                            });
                        }, 500);
                    });
                });
            });
        });
    });
    it('should handle connections overflow', done => {
        const momentum = new MomentumServer('mongodb://localhost:27017/momentum');
        momentum.options.maxTokensPerIp = 3;
        const app = emulateApp();
        momentum.start(app).then(() => {
            app.call('get', '/api/mm/ready').then(() => {
                app.call('get', '/api/mm/ready').then(() => {
                    app.call('get', '/api/mm/ready').then(() => {
                        app.call('get', '/api/mm/ready').then(result => {
                            expect(typeof result).toBe('object');
                            expect(result.error).toBe('Too many connections');
                            momentum.stop().then(done);
                        });
                    });
                });
            });
        });
    });
    it('should have a port setting editable', () => {
        const momentum = new MomentumServer('mongodb://localhost:27017/momentum');
        momentum.setApplicationPort(22);

        expect(momentum.appPort).toBe(22);
    });
    it('should start and stop successfully with no app', done => {
        const momentum = new MomentumServer('mongodb://localhost:27017/momentum');

        momentum.start(8092);
        momentum.stop();
        momentum.start(8092);
        momentum.start(8092).then(() => {
            expect(typeof momentum.app.use).toBe('function');
            momentum.stop().then(done);
        });
    });
    it('should start and stop successfully with an app', done => {
        const momentum = new MomentumServer('mongodb://localhost:27017/momentum');
        const app = {get() {}, post () {}};

        momentum.start(app).then(() => {
            expect(momentum.app).toBe(app);
            momentum.stop().then(done);
        });
    });
    it('should handle bad event argument', () => {
        const momentum = new MomentumServer('mongodb://localhost:27017/momentum');

        expect(() => momentum.on(false)).toThrow(new Error('event must be a string or an array'));
    });
    it('should handle events', done => {
        MomentumServer.connect(8092, 'mongodb://localhost:27017/momentum').then(momentum => {
            momentum.remove('config', {type: 'main'}).then(() => {
                const logs = [];
                momentum.onCollectionTouched('config', type => {
                    logs.push(type);
                });
                const config = {type: 'main', value: 3};
                momentum.insertOne('config', config).then(() => {
                    expect(momentum.getItemId(config)).toBeDefined();
                    momentum.count('config', {type: 'main'}).then(count => {
                        expect(count).toBe(1);
                        momentum.find('config', {type: 'main'}).then((configs) => {
                            expect(configs.length).toBe(1);
                            expect(configs[0].value).toBe(3);
                            const id = configs[0]._id;
                            let updated = false;
                            let removed = false;
                            momentum.onItemUpdate('config', id, () => {
                                updated = true;
                            });
                            momentum.onItemRemove('config', id, () => {
                                removed = true;
                            });
                            momentum.updateOne('config', {type: 'main'}, {$set: {value: 5}}).then(() => {
                                expect(updated).toBe(true);
                                expect(removed).toBe(false);
                                momentum.remove('config', {type: 'main'}).then(() => {
                                    expect(updated).toBe(true);
                                    expect(removed).toBe(true);
                                    expect(logs.length).toBe(3);
                                    expect(logs).toEqual(['insert', 'update-collection', 'remove-collection']);
                                    momentum.stop().then(done);
                                });
                            });
                        });
                    });
                });
            });
        });
    });
    it('should handle array events', done => {
        const momentum = new MomentumServer('mongodb://localhost:27017/momentum');
        momentum.start(8092).then(() => {
            let count = 0;
            momentum.on('foo', () => {
                count++;
            });
            momentum.on(['foo', 'bar'], () => {
                count++;
            });
            momentum.emit('foo');
            momentum.emit('foo');
            momentum.emit('bar');
            expect(count).toBe(5);
            momentum.stop().then(done);
        });
    });
    it('should handle grouped events', done => {
        const momentum = new MomentumServer('mongodb://localhost:27017/momentum');
        momentum.start(8092).then(() => {
            let count = 0;
            const offCollection = momentum.onCollectionTouched('foo', () => {
                count++;
            });
            const offItem = momentum.onItemTouched('foo', '1', () => {
                count++;
            });
            momentum.emitEvent('updateCollection', 'foo');
            momentum.emitEvent('updateCollection', 'bar');
            momentum.emitEvent('removeCollection', 'foo');
            momentum.emitEvent('insert', 'foo');
            expect(count).toBe(3);
            offCollection();
            count = 0;
            momentum.emitEvent('updateCollection', 'foo');
            momentum.emitEvent('removeCollection', 'foo');
            momentum.emitEvent('insert', 'foo');
            expect(count).toBe(0);
            count = 0;
            momentum.emitEvent('updateItem', 'foo:1');
            momentum.emitEvent('removeItem', 'foo:1');
            momentum.emitEvent('removeItem', 'foo:2');
            expect(count).toBe(2);
            offItem();
            count = 0;
            momentum.emitEvent('updateItem', 'foo:1');
            momentum.emitEvent('removeItem', 'foo:1');
            expect(count).toBe(0);
            momentum.stop().then(done);
        });
    });
    it('should handle remove failure', done => {
        MomentumServer.addAdapter('foobar', FoobarAdapter);
        const momentum = new MomentumServer('foo:bar');

        momentum.start(8092).then(() => {
            let error = null;
            momentum.remove('foo', {}).catch(err => {
                error = err;
            }).then(() => {
                expect(error + '').toBe('fake-error');
                momentum.stop().then(done);
            });
        });
    });
});
