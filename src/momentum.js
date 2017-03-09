const net = require('net');
const express = require('express');
const mondogbAdapter = require('./adapter/mongodb');
const adapters = {
    mongodb: mondogbAdapter
};
const getAdapter = (...args) => {
    const names = Object.keys(adapters);
    while (names.length) {
        const name = names.shift();
        const AdapterClass = adapters[name];
        if (AdapterClass.isCompatible(...args)) {
            return new AdapterClass(...args);
        }
    }

    return null;
};

class Momentum {
    constructor(...args) {
        this.adapter = getAdapter(...args);
    }

    static addAdapter(name, adapter) {
        adapters[name] = adapter;
    }

    linkApplication(app) {
        this.linkedApp = app;
    }

    setApplicationPort(appPort) {
        this.appPort = appPort;
    }

    start(app = null) {
        let appPort = null;
        if (!isNaN(app)) {
            appPort = app;
            app = null;
        }
        this.setApplicationPort(appPort);
        this.linkApplication(app);
        this.app = this.linkedApp || (() => {
                const expressApp = express();
                expressApp.listen(this.appPort);

                return expressApp;
            })();
        this.server = net.createServer(socket => {
            socket.end('quit\n');
        }).on('error', (err) => {
            throw err;
        });
    }
}

module.exports = Momentum;
