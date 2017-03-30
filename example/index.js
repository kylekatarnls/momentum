const path = require('path');
const opn = require('opn');
const express = require('express');
const app = express();
const MomentumServer = require('../src/momentum-server');
app.listen(8091);
app.use(express.static(path.resolve(__dirname, 'static')));
app.use(express.static(path.resolve(__dirname, '../lib')));

MomentumServer.connect(app, 'mongodb://localhost:27017/momentum').then(momentum => {
    setInterval(() => {
        const date = new Date();
        date.setTime(date.getTime() - 60000);
        momentum.remove('pointers', {date: {$lt: date}});
    }, 5000);
    opn('http://localhost:8091');
});
