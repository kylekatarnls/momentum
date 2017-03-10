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
        captureTimeout: 5000,
        expressHttpServer: {
            port: 8092,
            appVisitor: function (app, log) {
                app.use(function (request, response, next) {
                    response.header('Access-Control-Allow-Origin', '*');
                    next();
                });
                Momentum.connect(app, 'mongodb://localhost:27017/momentum').then(momentum => {
                    // momentum.setAuthorizationStrategy((method, args, request, response) => {
                    //     console.log('foo')
                    // });
                });
            }
        },
    };

    if (process.env.TRAVIS) {
        params.browsers = [
            'ChromeTravisCI',
            'PhantomJS'
        ];
    }

    config.set(params);
};
