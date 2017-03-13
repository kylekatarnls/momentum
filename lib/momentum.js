(function (root, factory) {
    /* istanbul ignore next */
    if (typeof define === "function" && define.amd) {
        define(factory);
    } else if (typeof exports === "object") {
        module.exports = factory();
    } else {
        root.Momentum = factory();
    }
}(this, function () {
    /* istanbul ignore next */
    if (typeof window === "undefined") {
        return null;
    }

    var ajax = {};
    ajax.x = function () {
        /* istanbul ignore next */
        if (typeof XMLHttpRequest !== 'undefined') {
            return new XMLHttpRequest();
        }
        /* istanbul ignore next */
        var versions = [
            "MSXML2.XmlHttp.6.0",
            "MSXML2.XmlHttp.5.0",
            "MSXML2.XmlHttp.4.0",
            "MSXML2.XmlHttp.3.0",
            "MSXML2.XmlHttp.2.0",
            "Microsoft.XmlHttp"
        ];

        /* istanbul ignore next */
        var xhr;
        /* istanbul ignore next */
        for (var i = 0; i < versions.length; i++) {
            try {
                xhr = new ActiveXObject(versions[i]);
                break;
            } catch (e) {
            }
        }

        /* istanbul ignore next */
        return xhr;
    };

    ajax.send = function (url, callback, method, data, sync, contentApplicationType) {
        var x = ajax.x();
        x.open(method, url, !sync);
        x.onreadystatechange = function () {
            if (x.readyState !== 4) {
                return;
            }

            callback(x.responseText);
        };
        if (method === 'POST') {
            x.setRequestHeader(
                'Content-type',
                'application/' + (contentApplicationType || 'x-www-form-urlencoded')
            );
        }
        x.send(data);

        return x;
    };

    ajax.params = function (data) {
        var query = [];
        for (var key in data) {
            if (data.hasOwnProperty(key)) {
                query.push(encodeURIComponent(key) + '=' + encodeURIComponent(data[key]));
            }
        }

        return query.join('&');
    };

    ajax.get = function (url, data, callback, sync) {
        var query = ajax.params(data);
        return ajax.send(url + (query.length ? '?' + query : ''), callback, 'GET', null, sync);
    };

    ajax.post = function (url, data, callback, sync) {
        return ajax.send(url, callback, 'POST', ajax.params(data), sync);
    };

    ajax.postJson = function (url, data, callback, sync) {
        return ajax.send(url, callback, 'POST', JSON.stringify(data), sync, 'json');
    };

    ajax.json = function (s) {
        try {
            return JSON.parse(s);
        } catch (e) {
            throw new Error(e + ' in ' + s);
        }
    };

    ajax.jsonToObject = function (data) {
        try {
            return JSON.parse(data);
        } catch (e) {
            return {};
        }
    };

    ajax.jsonCallback = function (data, callback) {
        if (!callback) {
            return;
        }

        callback(ajax.json(data));
    };

    function Momentum(url) {
        this.isReady = false;
        this.callbacks = [];
        this.url = url || '';
        this.token = null;
        this.lastEvent = null;
    }

    Momentum.prototype.getAjax = function () {
        return ajax;
    };

    Momentum.prototype.setUrlPrefix = function (urlPrefix) {
        this.urlPrefix = urlPrefix;
    };

    Momentum.prototype.getUrlPrefix = function () {
        return this.urlPrefix || '/api/mm/';
    };

    Momentum.prototype.onReady = function (callback) {
        if (this.isReady) {
            callback();

            return;
        }
        if (this.callbacks.push(callback) === 1) {
            var retry = function () {
                var xhr = ajax.get(this.url + this.getUrlPrefix() + 'ready', {}, function (data) {
                    data = ajax.jsonToObject(data);
                    if (data.status !== 'success') {
                        if (xhr.status === 429) {
                            throw new Error(data.error);
                        }

                        setTimeout(retry, 500);

                        return;
                    }

                    this.token = data.token;
                    this.isReady = true;
                    this.callbacks.forEach(function (callback) {
                        callback();
                    });
                    this.callbacks = [];
                }.bind(this));
            }.bind(this);
            retry();
        }

        return this;
    };

    Momentum.prototype.on = function (callback) {
        var xhr;
        var listen = function () {
            this.onReady(function () {
                xhr = ajax.get(this.url + this.getUrlPrefix() + 'on', {
                    token: this.token || '',
                    lastEvent: this.lastEvent || ''
                }, function (data) {
                    ajax.jsonCallback(data, callback);
                    listen();
                });
            }.bind(this));
        }.bind(this);
        listen();

        return function () {
            callback = function () {};
            listen = function () {};
            if (xhr) {
                xhr.abort();
            }
        };
    };

    Momentum.prototype.sendJson = function (url, params, callback) {
        params.token = this.token || '';

        return ajax.postJson(this.url + this.getUrlPrefix() + url, params, function (data) {
            ajax.jsonCallback(data, callback);
        });
    };

    Momentum.prototype.emit = function (method, args, callback) {
        return this.sendJson('emit', {
            method: method,
            args: args
        }, callback);
    };

    Momentum.prototype.listenCollection = function (collection, filter, callback) {
        if (typeof filter === 'function') {
            callback = filter;
            filter = null;
        }

        return this.sendJson('listen', {
            collection: collection,
            filter: filter
        }, callback);
    };

    Momentum.prototype.listenItem = function (collection, id, callback) {
        return this.sendJson('listen', {
            collection: collection,
            id: id
        }, callback);
    };

    Momentum.prototype.remove = function (args, callback) {
        return this.emit('remove', args, callback);
    };

    Momentum.prototype.insertOne = function (args, callback) {
        return this.emit('insertOne', args, callback);
    };

    Momentum.prototype.updateOne = function (args, callback) {
        return this.emit('updateOne', args, callback);
    };

    return Momentum;
}));
