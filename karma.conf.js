const bodyParser = require('body-parser');
const Momentum = require('./src/momentum');

module.exports = config => {
    const params = {
        basePath: '',
        frameworks: [
            'express-http-server',
            'jasmine'
        ],
        files: [
            'lib/**/*.js'
        ],
        colors: true,
        singleRun: true,
        logLevel: config.LOG_INFO,
        browsers: [
            'Chrome',
            'PhantomJS'
        ],
        concurrency: Infinity,
        reporters: [
            'progress',
            'coverage'
        ],
        preprocessors: {
            'lib/**/*.js': ['coverage']
        },
        customLaunchers: {
            ChromeTravisCI: {
                base: 'Chrome',
                flags: ['--no-sandbox']
            }
        },
        coverageReporter: {
            dir: 'coverage/',
            reporters: [
                {
                    type: 'html',
                    subdir: 'report'
                },
                {
                    type: 'lcovonly',
                    subdir: './',
                    file: 'coverage-front.info'
                }
            ]
        },
        captureTimeout: 30000,
        expressHttpServer: {
            port: 8092,
            appVisitor: function (app, log) {
                app.use(bodyParser.urlencoded({
                    extended: true
                }));
                app.use(bodyParser.json());
                app.use(function (request, response, next) {
                    log.info('navigate', request.method, request.url);
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
                Momentum.connect(app, 'mongodb://localhost:27017/momentum').then(momentum => {
                    momentum.invalidateTokens({ip: {$in: ['::1', '127.0.0.1']}});
                });
            }
        }
    };

    if (process.env.TRAVIS) {
        params.browsers = [
            'ChromeTravisCI',
            'PhantomJS'
        ];
    }

    config.set(params);
};
