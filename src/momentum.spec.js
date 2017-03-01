const Momentum = require('./momentum');

describe('Momentum', () => {
    it('start', (done) => {
        const momentum = new Momentum('mongodb://localhost:27017/momentum');

        momentum.adapter.start().then(() => {
            const bob = {
                name: 'Bob',
                date: new Date()
            };
            momentum.adapter.insertOne('users', bob).then(() => {
                momentum.adapter.find('users', {}).sort({date: -1}).limit(1).toArray((err, users) => {
                    if (err) {
                        throw err;
                    }

                    expect(users.length).toBe(1);
                    expect(users[0].name).toBe('Bob');
                    done();
                });
            }).catch(err => {
                throw err;
            });
        }).catch(err => {
            throw err;
        });
    });
});
