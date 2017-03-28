const bodyParser = require('body-parser');
const MomentumServer = require('../src/momentum-server');

function App(app, log) {
    app.use(bodyParser.urlencoded({
        extended: true
    }));
    app.use(bodyParser.json());
    app.use(function (request, response, next) {
        if (~(request.headers['user-agent'] + '').indexOf('PhantomJS')) {
            request.headers['x-forwarded-for'] = 'phjs';
        }
        response.header('Access-Control-Allow-Origin', '*');
        response.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
        response.header('Access-Control-Allow-Headers', 'Content-Type');
        response.header('Access-Control-Max-Age', '86400');
        next();
    });
    app.options('/reflect', function (request, response) {
        response.status(200).end('');
    });
    const methods = {
        get: 'query',
        post: 'body'
    };
    Object.keys(methods).forEach(function (method) {
        app[method]('/reflect', function (request, response) {
            log.info(method, methods[method], request[methods[method]]);
            response.status(200).json(request[methods[method]]);
        });
    });
    MomentumServer.connect(app, 'mongodb://localhost:27017/momentum').then(momentum => {
        momentum.options.maxTokensPerIp = 3;
        momentum.invalidateTokens({ip: {$in: ['phjs', '::1', '127.0.0.1']}});
    });
}

module.exports = App;
