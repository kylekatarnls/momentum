const path = require('path');
const opn = require('opn');
const express = require('express');
const app = express();
const MomentumServer = require('../src/momentum-server');
app.listen(8091);
app.use(express.static(path.resolve(__dirname, 'static')));
app.use(express.static(path.resolve(__dirname, '../lib')));

MomentumServer.connect(app, 'mongodb://localhost:27017/momentum').then(() => {
    opn('http://localhost:8091');
});
