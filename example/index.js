const path = require('path');
const opn = require('opn');
const express = require('express');
const app = express();
const MomentumServer = require('../src/momentum-server');
app.listen(8091);
app.use(express.static(path.resolve(__dirname, 'static')));
app.use(express.static(path.resolve(__dirname, '../lib')));

MomentumServer.connect(app, 'mongodb://localhost:27017/momentum').then(momentum => {
    momentum.setAuthorizationStrategy((mode, method, args) => {
        return new Promise(resolve => {
            // For people collection
            if (args[0] === 'people') {
                // Allow both:
                //  - data mode = read operations (find, findOne, count)
                //  - insertOne
                resolve(mode === 'data' || method === 'insertOne');

                return;
            }

            // For example config
            if (args[0] === 'exampleConfig') {
                // Allow both:
                //  - data mode = read operations (find, findOne, count)
                //  - insertOne
                if (method === 'insertOne') {
                    args[1] = {
                        counter: args[1].counter
                    };
                }

                resolve(() => {
                    if (mode === 'data') {
                        return true;
                    }

                    if (method === 'insertOne' || method === 'updateOne') {
                        return args[1].counter === 1;
                    }

                    return false;
                });

                return;
            }

            // Disallow any command on other collections
            resolve(false);
        });
    });
    opn('http://localhost:8091');
});

process.on('unhandledRejection', error => {
    console.log(error);
});
