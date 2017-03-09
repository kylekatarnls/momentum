const AdapterInterface = require('./adapter/interface');
const Momentum = require('./momentum');

class FoobarAdapter extends AdapterInterface {
    static isCompatible(url) {
        return url.indexOf('foo:') === 0;
    }

    getBar() {
        return 42;
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
                    done();
                });
            });
        });
    });
    it('should have null adapter with wrong arguments', () => {
        const momentum = new Momentum('foobar');

        expect(momentum.adapter).toBe(null);
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
    it('should have a port setting editable', () => {
        const momentum = new Momentum('mongodb://localhost:27017/momentum');
        momentum.setApplicationPort(22);

        expect(momentum.appPort).toBe(22);
    });
    it('should start successfully with no app', () => {
        const momentum = new Momentum('mongodb://localhost:27017/momentum');

        momentum.start(8091);
        expect(typeof momentum.app.use).toBe('function');
        expect(typeof momentum.server.listen).toBe('function');
    });
});
