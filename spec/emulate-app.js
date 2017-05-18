const emulateApp = () => ({
    token: null,
    getRoutes: {},
    postRoutes: {},
    lastResponse: null,
    get(route, callback) {
        this.getRoutes[route] = callback;
    },
    post(route, ...callbacks) {
        this.postRoutes[route] = callbacks.pop();
    },
    getLastResponse() {
        return this.lastResponse;
    },
    call(method, route, body = {}) {
        body.token = this.token;
        const app = this;

        return new Promise(resolve => {
            this.lastResponse = {
                status() {
                    return this;
                },
                json(data) {
                    data = JSON.parse(JSON.stringify(data));
                    if (data.token) {
                        app.token = data.token;
                    }

                    resolve(data);

                    return this;
                }
            };
            this[method + 'Routes'][route]({
                setTimeout() {
                },
                headers: {},
                connection: {
                    remoteAddress: '127.0.0.1'
                },
                body,
                query: body
            }, this.lastResponse);
        });
    }
});

module.exports = emulateApp;
