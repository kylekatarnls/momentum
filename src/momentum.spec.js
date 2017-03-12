const AdapterInterface = require('./adapter/interface');
const Momentum = require('./momentum');

class FoobarAdapter extends AdapterInterface {
    static isCompatible(url) {
        return url.indexOf('foo:') === 0;
    }

    start() {
        return new Promise(resove => {
            resove(true);
        });
    }

    stop() {
    }

    getBar() {
        return 42;
    }

    find() {
        return {
            toArray(callback) {
                callback('fake-error', []);
            }
        }
    }
}

describe('Momentum', () => {
    it('should start successfully with mongodb', (done) => {
        const momentum = new Momentum('mongodb://localhost:27017/momentum');

        momentum.adapter.start().then(() => {
            const bob = {
                name: 'Bob',
                date: new Date()
            };
            momentum.adapter.insertOne('users', bob).then(() => {
                momentum.adapter.find('users', {}).sort({date: -1}).limit(1).toArray((err, users) => {
                    expect(err).toBe(null);
                    expect(users.length).toBe(1);
                    expect(users[0].name).toBe('Bob');
                    momentum.adapter.stop();
                    done();
                });
            });
        });
    });
    it('should have null adapter with wrong arguments', () => {
        const momentum = new Momentum('foobar');
        momentum.stop();

        expect(momentum.adapter).toBe(null);
    });
    it('should have an editable url prefix', () => {
        const momentum = new Momentum('foobar');
        expect(momentum.getUrlPrefix()).toBe('/api/mm/');
        momentum.setUrlPrefix('/mm/api/');
        expect(momentum.getUrlPrefix()).toBe('/mm/api/');
    });
    it('should have an editable authorization strategy', (done) => {
        const momentum = new Momentum('foobar');
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
        Momentum.addAdapter('foobar', FoobarAdapter);
        const momentum = new Momentum('foo:bar');

        expect(momentum.adapter.getBar()).toBe(42);
    });
    it('should be able to link to an app', () => {
        const momentum = new Momentum('mongodb://localhost:27017/momentum');
        momentum.linkApplication({a: 42});

        expect(momentum.linkedApp.a).toBe(42);
    });
    it('should listen the /on route', (done) => {
        const momentum = new Momentum('mongodb://localhost:27017/momentum');
        const app = {
            routes: {},
            get(route, callback) {
                this.routes[route] = callback;
            },
            call(route) {
                return new Promise(resolve => {
                    this.routes[route]({}, {
                        status() {
                            return this;
                        },
                        json(data) {
                            resolve(data);

                            return this;
                        }
                    });
                });
            }
        };
        momentum.start(app).then(() => {
            app.call('/api/mm/on').then(result => {
                expect(typeof result).toBe('object');
                expect(result.status).toBe('success');
                app.call('/api/mm/ready').then(result => {
                    expect(typeof result).toBe('object');
                    expect(result.status).toBe('success');
                    done();
                });
            });
        });

    });
    it('should have a port setting editable', () => {
        const momentum = new Momentum('mongodb://localhost:27017/momentum');
        momentum.setApplicationPort(22);

        expect(momentum.appPort).toBe(22);
    });
    it('should start and stop successfully with no app', (done) => {
        const momentum = new Momentum('mongodb://localhost:27017/momentum');

        momentum.start(8091);
        momentum.stop();
        momentum.start(8091);
        momentum.start(8091).then(() => {
            expect(typeof momentum.app.use).toBe('function');
            momentum.stop();
            done();
        });
    });
    it('should start and stop successfully with an app', (done) => {
        const momentum = new Momentum('mongodb://localhost:27017/momentum');
        const app = {get() {}};

        momentum.start(app).then(() => {
            expect(momentum.app).toBe(app);
            momentum.stop();
            done();
        });
    });
    it('should handle bad event argument', () => {
        const momentum = new Momentum('mongodb://localhost:27017/momentum');

        expect(() => momentum.on(false)).toThrow(new Error('event must be a string or an array'));
    });
    it('should handle events', (done) => {
        Momentum.connect(8091, 'mongodb://localhost:27017/momentum').then(momentum => {
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
                        momentum.find('config', {type: 'main'}).toArray((err, configs) => {
                            expect(err).toBe(null);
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
                                    momentum.stop();
                                    done();
                                });
                            });
                        });
                    });
                });
            });
        });
    });
    it('should handle array events', (done) => {
        const momentum = new Momentum('mongodb://localhost:27017/momentum');
        momentum.start(8091).then(() => {

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
            momentum.stop();
            done();
        });
    });
    it('should handle remove failure', (done) => {
        Momentum.addAdapter('foobar', FoobarAdapter);
        const momentum = new Momentum('foo:bar');

        momentum.start(8091).then(() => {
            let error = null;
            momentum.remove('foo', {}).catch(err => {
                error = err;
            }).then(() => {
                expect(error + '').toBe('fake-error');
                momentum.stop();
                done();
            });
        });
    });
});
