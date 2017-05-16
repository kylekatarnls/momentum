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

    /**
     * Call a function (if given) with arguments.
     * @param callback
     */
    var execute = function (callback) {
        if (typeof callback === 'function') {
            callback.apply(this, [].slice.call(arguments, 1));
        }
    };

    /**
     * Execute a function (if given) on each key/value of an object.
     * @param data
     * @param callback
     */
    var forEach = function (data, callback) {
        for (var key in data) {
            if (data.hasOwnProperty(key)) {
                execute(callback, key, data[key]);
            }
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
        forEach(data, function (key, value) {
            query.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
        });

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
        this.readyCallbacks = [];
        this.eventCallbacks = [];
        this.url = url || '';
        this.token = null;
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
        this.readyCallbacks.forEach(function (callback) {
            execute(callback, this.readyError);
        }.bind(this));
        this.readyCallbacks = [];
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
        } else if (this.readyCallbacks.push(callback) === 1) {
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
     * Exit session by invalidate the session token.
     *
     * @param {Function} callback
     *
     * @returns {XMLHttpRequest}
     */
    Momentum.prototype.quit = function (callback) {
        return ajax.get(this.url + this.getUrlPrefix() + 'quit', {
            token: this.token
        }, function (data) {
            ajax.jsonCallback(data, callback);
        });
    };

    /**
     * Remove a listener from the momentum instance.
     *
     * @param {Function} callback
     *
     * @returns this
     */
    Momentum.prototype.off = function (callback) {
        this.eventCallbacks = this.eventCallbacks.filter(function (c) {
            return c !== callback;
        });

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
        if (typeof callback !== 'function') {
            return function () {};
        }

        var xhr;
        this.off(callback);
        callback._history = {};
        if (this.eventCallbacks.push(callback) === 1) {
            var listen = function () {
                this.onReady(function (error) {
                    if (!error) {
                        xhr = ajax.get(this.url + this.getUrlPrefix() + 'on', {
                            token: this.token
                        }, function (data) {
                            ajax.jsonCallback(data, function (data) {
                                this.trigger((data || {}).events || []);
                            }.bind(this));
                            listen();
                        }.bind(this));
                    }
                }.bind(this));
            }.bind(this);
            listen();

            this.stopListening = function () {
                this.eventCallbacks = [];
                listen = function () {};
                if (xhr) {
                    xhr.abort();
                }
            };
        }

        return function () {
            this.off(callback);
            if (!this.eventCallbacks.length) {
                this.stopListening();
            }
        }.bind(this);
    };

    /**
     * Trigger events.
     *
     * @param {Array} events
     *
     * @returns this
     */
    Momentum.prototype.trigger = function (events) {
        if (this.eventCallbacks.length && events.length) {
            this.eventCallbacks.forEach(function (callback) {
                events.forEach(function (event) {
                    var params = event.args.slice();
                    var id = params.pop();
                    if (Object.keys(callback._history).indexOf(id) === -1) {
                        callback._history[id] = params;
                        execute(callback, event);
                    }
                });
            });
        }

        return this;
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
     * Execute a CRUD command.
     *
     * @param {string}   route    "emit" for writing, "data" for reading
     * @param {string}   method   updateOne, updateMany, insertOne, insertMany or remove
     * @param {Array}    args     arguments to pass to the momentum method
     * @param {Function} callback function to be executed with the response data
     *
     * @returns this
     */
    Momentum.prototype.crud = function (route, method, args, callback) {
        return this.sendJson(route, {
            method: method,
            args: args
        }, callback);
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
        return this.crud('emit', method, args, callback);
    };

    /**
     * Get data via findOne, find or count sent to the momentum server.
     *
     * @param {string}   method   findOne, find or count
     * @param {Array}    args     arguments to pass to the momentum method
     * @param {Function} callback function to be executed with the response data
     *
     * @returns this
     */
    Momentum.prototype.getData = function (method, args, callback) {
        return this.crud('data', method, args, callback);
    };

    /**
     * Start/stop Listen events that happen on a given collection/item.
     *
     * @param {string}   url
     * @param {Object}   data
     * @param {Function} callback
     *
     * @returns this
     */
    Momentum.prototype.listenCommand = function (url, data, callback) {
        return this.sendJson('listen' + url, data, callback);
    };

    /**
     * Listen/stop events that happen on a given collection.
     *
     * @param {string}   route
     * @param {string}   collection
     * @param {string}   filter
     * @param {Function} callback
     *
     * @returns this
     */
    Momentum.prototype.collectionCommand = function (route, collection, filter, callback) {
        if (typeof filter === 'function') {
            callback = filter;
            filter = null;
        }

        return this.listenCommand(route, {
            collection: collection,
            filter: filter
        }, callback);
    };

    /**
     * Listen/stop events that happen on a given collection item.
     *
     * @param {string}   route
     * @param {string}   collection
     * @param {string}   id
     * @param {Function} callback
     *
     * @returns this
     */
    Momentum.prototype.itemCommand = function (route, collection, id, callback) {
        var collectionItem = {
            collection: collection,
            id: id
        };

        return this.listenCommand(route, collectionItem, callback);
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
        return this.collectionCommand('', collection, filter, callback);
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
        return this.itemCommand('', collection, id, callback);
    };

    /**
     * Stop listening events that happen on a given collection.
     *
     * @param {string}   collection
     * @param {string}   filter
     * @param {Function} callback
     *
     * @returns this
     */
    Momentum.prototype.stopListenCollection = function (collection, filter, callback) {
        return this.collectionCommand('/stop', collection, filter, callback);
    };

    /**
     * Stop listening events that happen on a given collection item.
     *
     * @param {string}   collection
     * @param {string}   id
     * @param {Function} callback
     *
     * @returns this
     */
    Momentum.prototype.stopListenItem = function (collection, id, callback) {
        return this.itemCommand('/stop', collection, id, callback);
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
     * Execute an insertOne command.
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
     * Execute an insertMany command.
     *
     * @param {Array}    args
     * @param {Function} callback
     *
     * @returns this
     */
    Momentum.prototype.insertMany = function (args, callback) {
        return this.emit('insertMany', args, callback);
    };

    /**
     * Execute an updateOne command.
     *
     * @param {Array}    args
     * @param {Function} callback
     *
     * @returns this
     */
    Momentum.prototype.updateOne = function (args, callback) {
        return this.emit('updateOne', args, callback);
    };

    /**
     * Execute an updateMany command.
     *
     * @param {Array}    args
     * @param {Function} callback
     *
     * @returns this
     */
    Momentum.prototype.updateMany = function (args, callback) {
        return this.emit('updateMany', args, callback);
    };

    /**
     * Execute a findOne command.
     *
     * @param {Array}    args
     * @param {Function} callback
     *
     * @returns this
     */
    Momentum.prototype.findOne = function (args, callback) {
        return this.getData('findOne', args, callback);
    };

    /**
     * Execute a find command.
     *
     * @param {Array}    args
     * @param {Function} callback
     *
     * @returns this
     */
    Momentum.prototype.find = function (args, callback) {
        return this.getData('find', args, callback);
    };

    /**
     * Execute a count command.
     *
     * @param {Array}    args
     * @param {Function} callback
     *
     * @returns this
     */
    Momentum.prototype.count = function (args, callback) {
        return this.getData('count', args, callback);
    };

    /**
     * Retrieve a collection of items.
     *
     * @param {string}   collection
     * @param {Function} callback
     *
     * @returns this
     */
    Momentum.prototype.getCollection = function (collection, callback) {
        this.listenCollection(collection);

        return this.find([collection], function (data) {
            callback(new Collection(this, collection, data.result));
        }.bind(this));
    };

    /**
     * Retrieve a collection item.
     *
     * @param {string}   collection
     * @param {string}   id
     * @param {Function} callback
     *
     * @returns this
     */
    Momentum.prototype.getItem = function (collection, id, callback) {
        this.listenItem(collection, id);

        return this.findOne([collection, {_id: id}], function (data) {
            callback(data && data.result && (new Collection(this, collection, [data.result]))[0]);
        }.bind(this));
    };

    var arrayPrototype = Array.prototype;

    /**
     * Initialize a collection of items.
     *
     * @param {Momentum} momentum
     * @param {string}   name
     * @param {Array}    data
     * @constructor
     */
    function Collection(momentum, name, data) {
        this._momentum = momentum;
        this._name = name;
        this._changeEvents = [];
        this.append(data);
        this._stop = momentum.on(function (event) {
            if (event.listen.collection === name && !event.listen.filter) {
                if (event.args[0] === 'insert') {
                    this.append(event.args[3].items || [event.args[3].item]);
                }
                this._changeEvents.forEach(function (callback) {
                    execute.apply(this, [callback, event.args[3]]);
                });
            }
        }.bind(this));
    }

    Collection.prototype = arrayPrototype;

    /**
     * Append items data as item instances in the collection data.
     *
     * @returns this
     */
    Collection.prototype.append = function (data) {
        arrayPrototype.push.apply(this, (data || []).filter(function (properties) {
            return properties;
        }).map(function (properties) {
            return new Item(this, {_id: properties._id}, properties);
        }.bind(this)));

        return this;
    };

    /**
     * Get collection name.
     *
     * @returns {string}
     */
    Collection.prototype.getName = function () {
        return this._name;
    };

    /**
     * Get momentum linked server.
     *
     * @returns {string}
     */
    Collection.prototype.getMomentum = function () {
        return this._momentum;
    };

    /**
     * Get collection name.
     *
     * @returns {string}
     */
    Collection.prototype.hasId = function (id) {
        for (var i = 0; i < this.length; i++) {
            if (this[i]._id === id) {
                return true;
            }
        }

        return false;
    };

    /**
     * Add a listener on change event and return a callback
     * to remote it.
     *
     * @param {Function} callback
     *
     * @returns {Function}
     */
    Collection.prototype.onChange = function (callback) {
        this._changeEvents.push(callback);

        return function () {
            this._changeEvents = this._changeEvents.filter(function (c) {
                return c !== callback;
            });
        }.bind(this);
    };

    /**
     * Add a listener on update event and return a callback
     * to remote it.
     *
     * @param {Function} callback
     *
     * @returns {Function}
     */
    Collection.prototype.onUpdate = function (callback) {
        return this.onChange(function (event) {
            if (event.name === 'update') {
                callback(event);
            }
        });
    };

    /**
     * Stop listening the collection events.
     */
    Collection.prototype.stop = function () {
        this._stop();
        this.getMomentum().stopListenCollection(this.getName());
    };

    /**
     * Call a method of the collection object from the item.
     *
     * @param {string}   method
     * @param {Array}    args
     * @param {Function} callback
     */
    Collection.prototype.emit = function (method, args, callback) {
        var params = [].slice.call(args);
        params.unshift(this.getName());
        this.getMomentum()[method](params, callback);
    };

    /**
     * Execute a remove command.
     *
     * @param {Object}   item
     * @param {Function} callback
     *
     * @returns this
     */
    Collection.prototype.remove = function (item, callback) {
        return this.emit('remove', [item], callback);
    };

    /**
     * Execute an insertOne command.
     *
     * @param {Object}   item
     * @param {Function} callback
     *
     * @returns this
     */
    Collection.prototype.insertOne = function (item, callback) {
        return this.emit('insertOne', [item], callback);
    };

    /**
     * Execute an insertMany command.
     *
     * @param {Array}    items
     * @param {Function} callback
     *
     * @returns this
     */
    Collection.prototype.insertMany = function (items, callback) {
        return this.emit('insertMany', [items], callback);
    };

    /**
     * Execute an updateMany command.
     *
     * @param {Array}    args
     * @param {Object}   options
     * @param {Function} callback
     *
     * @returns this
     */
    Collection.prototype.parseArguments = function (args, options, callback) {
        if (typeof options === 'function') {
            callback = options;
            options = null;
        }
        if (options) {
            args.push(options);
        }

        return callback;
    };

    /**
     * Execute an updateOne command.
     *
     * @param {Object}   item
     * @param {Object}   update
     * @param {Object}   options
     * @param {Function} callback
     *
     * @returns this
     */
    Collection.prototype.updateOne = function (item, update, options, callback) {
        var args = [item, update];
        callback = this.parseArguments(args, options, callback);

        return this.emit('updateOne', args, callback);
    };

    /**
     * Execute an updateMany command.
     *
     * @param {Object}   filter
     * @param {Object}   update
     * @param {Object}   options
     * @param {Function} callback
     *
     * @returns this
     */
    Collection.prototype.updateMany = function (filter, update, options, callback) {
        var args = [filter, update];
        callback = this.parseArguments(args, options, callback);

        return this.emit('updateMany', args, callback);
    };

    /**
     * Initialize a collection item.
     *
     * @param {Collection} collection
     * @param {Object}     identity
     * @param {Object}     properties
     * @constructor
     */
    function Item(collection, identity, properties) {
        this._collection = collection;
        this._identity = identity;
        forEach(properties, function (key, value) {
            this[key] = value;
        }.bind(this));
    }

    /**
     * Get an object that identify an item.
     *
     * @returns {Object}
     */
    Item.prototype.getIdentity = function () {
        var identity = {};
        for (var key in this._identity) {
            if (this._identity.hasOwnProperty(key)) {
                identity[key] = this._identity[key];
            }
        }

        return identity;
    };

    /**
     * Get the collection which the item belongs to.
     *
     * @returns {Collection}
     */
    Item.prototype.getCollection = function () {
        return this._collection;
    };

    /**
     * Add a listener on change event and return a callback
     * to remote it.
     *
     * @param {Function} callback
     * @param {string}   method (optional)
     *
     * @returns {Function}
     */
    Item.prototype.onChange = function (callback, method) {
        return this.getCollection()[method || 'onChange'](function (event) {
            callback(event);
        });
    };

    /**
     * Add a listener on update event and return a callback
     * to remote it.
     *
     * @param {Function} callback
     *
     * @returns {Function}
     */
    Item.prototype.onUpdate = function (callback) {
        return this.onChange(callback, 'onUpdate');
    };

    /**
     * Execute an updateOne command on an item.
     *
     * @param {Object}   update command
     * @param {Function} callback
     *
     * @returns this
     */
    Item.prototype.update = function (update, callback) {
        this.getCollection().updateOne(this.getIdentity(), update, callback);

        return this;
    };

    /**
     * Edit properties of an item.
     *
     * @param {Object}   properties
     * @param {Function} callback
     *
     * @returns this
     */
    Item.prototype.set = function (properties, callback) {
        return this.update({$set: properties}, callback);
    };

    /**
     * Remove an item.
     *
     * @param {Function} callback
     *
     * @returns this
     */
    Item.prototype.remove = function (callback) {
        this.getCollection().remove(this.getIdentity(), callback);

        return this;
    };

    /**
     * Stop listening an item.
     *
     * @returns this
     */
    Item.prototype.stop = function () {
        var collection = this.getCollection();
        collection.getMomentum().stopListenItem(collection.getName(), this._id);
        collection.stop();

        return this;
    };

    Momentum.Collection = Collection;

    Momentum.Item = Item;

    return Momentum;
}));
