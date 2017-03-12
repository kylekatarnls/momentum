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
            if (x.readyState == 4) {
                callback(x.responseText)
            }
        };
        if (method == 'POST') {
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

    const json = JSON && JSON.parse ?
        JSON.parse.bind(JSON) :
        /* istanbul ignore next */
        window.eval.bind(window);

    ajax.json = function (s) {
        try {
            return json(s);
        } catch (e) {
            throw new Error(e + ' in ' + s);
        }
    };

    ajax.jsonToObject = function (data) {
        try {
            return ajax.json(data);
        } catch (e) {
            return {};
        }
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
            const retry = function () {
                ajax.get(this.url + this.getUrlPrefix() + 'ready', {}, function (data) {
                    data = ajax.jsonToObject(data);
                    if (data.status !== 'success') {
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
                    callback(ajax.json(data));
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

    Momentum.prototype.emit = function (method, args, callback) {
        return ajax.postJson(this.url + this.getUrlPrefix() + 'emit', {
            token: this.token || '',
            method: method,
            args: args
        }, function (data) {
            callback(ajax.json(data));
        });
    };

    Momentum.prototype.listenCollection = function (collection, filter, callback) {
        if (typeof filter === 'function') {
            callback = filter;
            filter = null;
        }

        return ajax.postJson(this.url + this.getUrlPrefix() + 'listen', {
            token: this.token || '',
            collection: collection,
            filter: filter
        }, function (data) {
            if (callback) {
                callback(ajax.json(data));
            }
        });
    };

    Momentum.prototype.listenItem = function (collection, id, callback) {
        return ajax.postJson(this.url + this.getUrlPrefix() + 'listen', {
            token: this.token || '',
            collection: collection,
            id: id
        }, function (data) {
            if (callback) {
                callback(ajax.json(data));
            }
        });
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
