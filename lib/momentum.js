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

    var execute = function (callback) {
        if (typeof callback === 'function') {
            callback.apply(this, [].slice.call(arguments, 1));
        }
    };

    var ajax = {};

    /**
     * Create an XHR object.
     *
     * @returns {XMLHttpRequest}
     */
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

    /**
     * Send an AJAX request.
     *
     * @param {string}   url
     * @param {Function} callback
     * @param {string}   method GET/POST/OPTIONS/PUT/DELETE
     * @param {Object}   data
     * @param {boolean}  sync
     * @param {string}   contentApplicationType
     *
     * @returns this
     */
    ajax.send = function (url, callback, method, data, sync, contentApplicationType) {
        var x = ajax.x();
        x.open(method, url, !sync);
        x.onreadystatechange = function () {
            if (x.readyState !== 4) {
                return;
            }

            execute(callback, x.responseText);
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

    /**
     * Format object into an urlencoded string.
     *
     * @param {Object} data
     *
     * @returns {string}
     */
    ajax.params = function (data) {
        var query = [];
        for (var key in data) {
            if (data.hasOwnProperty(key)) {
                query.push(encodeURIComponent(key) + '=' + encodeURIComponent(data[key]));
            }
        }

        return query.join('&');
    };

    /**
     * Send an HTTP GET request.
     *
     * @param {string}   url
     * @param {Object}   data
     * @param {Function} callback
     * @param {boolean}  sync
     *
     * @returns this
     */
    ajax.get = function (url, data, callback, sync) {
        var query = ajax.params(data);
        return ajax.send(url + (query.length ? '?' + query : ''), callback, 'GET', null, sync);
    };

    /**
     * Send an HTTP POST request (x-www-form-urlencoded).
     *
     * @param {string}   url
     * @param {Object}   data
     * @param {Function} callback
     * @param {boolean}  sync
     *
     * @returns this
     */
    ajax.post = function (url, data, callback, sync) {
        return ajax.send(url, callback, 'POST', ajax.params(data), sync);
    };


    /**
     * Send an HTTP POST request (json).
     *
     * @param {string}   url
     * @param {Object}   data
     * @param {Function} callback
     * @param {boolean}  sync
     *
     * @returns this
     */
    ajax.postJson = function (url, data, callback, sync) {
        return ajax.send(url, callback, 'POST', JSON.stringify(data), sync, 'json');
    };

    /**
     * Parse JSON string.
     *
     * @param {string} input JSON input string
     *
     * @throws Error if any parsing error occurs.
     *
     * @return {*}
     */
    ajax.json = function (input) {
        try {
            return JSON.parse(input);
        } catch (e) {
            throw new Error(e + ' in ' + input);
        }
    };

    /**
     * Parse JSON string and return it or an empty object if
     * any parsing error occurs.
     *
     * @param {string} input JSON input string
     *
     * @return {*}
     */
    ajax.jsonToObject = function (input) {
        try {
            return JSON.parse(input);
        } catch (e) {
            return {};
        }
    };

    /**
     * Take a JSON string and a callback and pass the parsed value
     * to this callback function. Nothing happens if callback empty.
     *
     * @param {string}   data
     * @param {Function} callback
     */
    ajax.jsonCallback = function (data, callback) {
        execute(callback, data ? ajax.json(data) : null);
    };

    /**
     * Momentum class constructor.
     *
     * @param {string} url base API server URL
     * @constructor
     */
    function Momentum(url) {
        this.isReady = false;
        this.readyError = null;
        this.callbacks = [];
        this.url = url || '';
        this.token = null;
        this.lastEvent = null;
    }

    /**
     * Return AJAX utils functions (.get, .post, etc.).
     *
     * @returns {{Function}}
     */
    Momentum.prototype.getAjax = function () {
        return ajax;
    };

    /**
     * Change the URL prefix that will come between the host URL
     * and the route.
     *
     * @param {string} urlPrefix
     *
     * @return this
     */
    Momentum.prototype.setUrlPrefix = function (urlPrefix) {
        this.urlPrefix = urlPrefix;

        return this;
    };

    /**
     * Return the current URL prefix.
     *
     * @returns {string}
     */
    Momentum.prototype.getUrlPrefix = function () {
        return this.urlPrefix || '/api/mm/';
    };

    /**
     * Set the instance ready or errored.
     *
     * @param {Object|string} error optional error state
     *
     * @returns this
     */
    Momentum.prototype.markAsReady = function (error) {
        this.readyError = error;
        this.isReady = true;
        this.callbacks.forEach(function (callback) {
            execute(callback, this.readyError);
        }.bind(this));
        this.callbacks = [];
    };

    /**
     * Execute the callback function given when the instance is
     * ready (receive its identification token from the server).
     *
     * @param {Function} callback
     *
     * @returns this
     */
    Momentum.prototype.onReady = function (callback) {
        if (this.isReady) {
            execute(callback, this.readyError);
        } else if (this.callbacks.push(callback) === 1) {
            var retry = function () {
                var xhr = ajax.get(this.url + this.getUrlPrefix() + 'ready', {}, function (data) {
                    data = ajax.jsonToObject(data);
                    if (data.status !== 'success') {
                        if (xhr.status === 429) {
                            this.markAsReady(new Error(data.error));

                            return;
                        }

                        setTimeout(retry, 500);

                        return;
                    }

                    this.token = data.token;
                    this.markAsReady();
                }.bind(this));
            }.bind(this);
            retry();
        }

        return this;
    };

    /**
     * Start listening events from the server with a long-pooling
     * HTTP request.
     *
     * @param {Function} callback
     *
     * @returns {Function}
     */
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

    /**
     * Send a JSON request on the momentum API server.
     *
     * @param {string}   url
     * @param {Object}   params
     * @param {Function} callback
     *
     * @returns this
     */
    Momentum.prototype.sendJson = function (url, params, callback) {
        params.token = this.token || '';

        return ajax.postJson(this.url + this.getUrlPrefix() + url, params, function (data) {
            ajax.jsonCallback(data, callback);
        });
    };

    /**
     * Emit a command (insertion, update or deletion) to the momentum server.
     *
     * @param {string}   method   updateOne, updateMany, insertOne, insertMany or remove
     * @param {Array}    args     arguments to pass to the momentum method
     * @param {Function} callback function to be executed with the response data
     *
     * @returns this
     */
    Momentum.prototype.emit = function (method, args, callback) {
        return this.sendJson('emit', {
            method: method,
            args: args
        }, callback);
    };

    /**
     * Listen events that happen on a given collection.
     *
     * @param {string}   collection
     * @param {string}   filter
     * @param {Function} callback
     *
     * @returns this
     */
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

    /**
     * Listen events that happen on a given collection item.
     *
     * @param {string}   collection
     * @param {string}   id
     * @param {Function} callback
     *
     * @returns this
     */
    Momentum.prototype.listenItem = function (collection, id, callback) {
        return this.sendJson('listen', {
            collection: collection,
            id: id
        }, callback);
    };

    /**
     * Execute a remove command.
     *
     * @param {Array}    args
     * @param {Function} callback
     *
     * @returns this
     */
    Momentum.prototype.remove = function (args, callback) {
        return this.emit('remove', args, callback);
    };

    /**
     * Execute a insertOne command.
     *
     * @param {Array}    args
     * @param {Function} callback
     *
     * @returns this
     */
    Momentum.prototype.insertOne = function (args, callback) {
        return this.emit('insertOne', args, callback);
    };

    /**
     * Execute a updateOne command.
     *
     * @param {Array}    args
     * @param {Function} callback
     *
     * @returns this
     */
    Momentum.prototype.updateOne = function (args, callback) {
        return this.emit('updateOne', args, callback);
    };

    return Momentum;
}));
