const MomentumServer = require('../src/momentum-server');
const emulateApp = require('./emulate-app');

const dbs = ['momentum', 'restricted-momentum', 'clone-momentum'];
let dbCount = dbs.length;
dbs.forEach(db => {
    MomentumServer.connect(emulateApp(), 'mongodb://localhost:27017/' + db).then(momentum => {
        const collections = [
            'aatokens',
            'animals',
            'config',
            'configm',
            'cookies',
            'counters',
            'documents',
            'insertions',
            'jedis',
            'magicans',
            'people',
            'table',
            'unitTests'
        ];
        let collectionCount = collections.length;
        collections.forEach(collection => {
            momentum.remove(collection, {}).then(() => {
                if (--collectionCount < 1) {
                    momentum.stop().then(() => {
                        if (--dbCount < 1) {
                            console.log('Cleanup done');
                        }
                    });
                }
            });
        });
    });
});
