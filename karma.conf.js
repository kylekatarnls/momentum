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
            dir : 'coverage/',
            reporters: [
                {
                    type : 'html',
                    subdir: 'report'
                },
                {
                    type : 'lcovonly',
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
                app.use(function (request, response, next) {
                    log.info('navigate', request.url);
                    response.header('Access-Control-Allow-Origin', '*');
                    next();
                });
                app.get('/reflect', function (request, response) {
                    response
                        .status(200)
                        .json(request.query);
                });
                app.post('/reflect', function (request, response) {
                    response
                        .status(200)
                        .json(request.body);
                });
                Momentum.connect(app, 'mongodb://localhost:27017/momentum');
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
