const opn = require('opn');
const express = require('express');
const app = express();
const Momentum = require('../src/momentum');
app.listen(8091);
app.use(express.static(__dirname + '/static'));
app.use(express.static(__dirname + '/../lib'));

Momentum.connect(app, 'mongodb://localhost:27017/momentum').then(momentum => {
    // momentum.setAuthorizationStrategy((method, args, request, response) => {
    //     console.log('foo')
    // });
});

opn('http://localhost:8091');
