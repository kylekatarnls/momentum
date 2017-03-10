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
        if (typeof XMLHttpRequest !== 'undefined') {
            return new XMLHttpRequest();
        }
        var versions = [
            "MSXML2.XmlHttp.6.0",
            "MSXML2.XmlHttp.5.0",
            "MSXML2.XmlHttp.4.0",
            "MSXML2.XmlHttp.3.0",
            "MSXML2.XmlHttp.2.0",
            "Microsoft.XmlHttp"
        ];

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

    ajax.send = function (url, callback, method, data, sync) {
        var x = ajax.x();
        x.open(method, url, !sync);
        x.onreadystatechange = function () {
            if (x.readyState == 4) {
                callback(x.responseText)
            }
        };
        if (method == 'POST') {
            x.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
        }
        x.send(data)
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
        ajax.send(url + (query.length ? '?' + query : ''), callback, 'GET', null, sync)
    };

    ajax.post = function (url, data, callback, sync) {
        ajax.send(url, callback, 'POST', ajax.params(data), sync)
    };

    const json = JSON && JSON.parse ?
        JSON.parse.bind(JSON) :
        /* istanbul ignore next */
        window.eval.bind(window);
    ajax.json = function (s) {
        try {
            return json(s);
        } catch (e) {
            return null;
        }
    };

    function Momentum(url) {
        this.url = url || '';
        this.token = null;
        this.lastEvent = null;
    }

    Momentum.prototype.setUrlPrefix = function (urlPrefix) {
        this.urlPrefix = urlPrefix;
    };

    Momentum.prototype.getUrlPrefix = function () {
        return this.urlPrefix || '/api/mm/';
    };

    Momentum.prototype.on = function (callback) {
        var xhr;
        var listen = function () {
            xhr = ajax.get(this.url + this.getUrlPrefix() + 'on', {
                token: this.token || '',
                lastEvent: this.lastEvent || ''
            }, function (data) {
                callback(ajax.json(data));
                listen();
            });
        }.bind(this);
        listen();

        return function () {
            listen = function () {};
            xhr.abort();
        };
    };

    Momentum.prototype.emit = function (method, args, callback) {
        return ajax.post(this.url + this.getUrlPrefix() + 'emit', {
            method: method,
            args: args
        }, function (data) {
            callback(ajax.json(data));
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
