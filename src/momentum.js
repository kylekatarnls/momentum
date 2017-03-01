const net = require('net');
const express = require('express');
const adapters = {
    mongodb: require('./adapter/mongodb'),
};

class Momentum {
    constructor(...args) {
        for (let name in adapters) {
            const AdapterClass = adapters[name];
            if (AdapterClass.isCompatible(...args)) {
                this.adapter = new AdapterClass(...args);
            }
        }
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
