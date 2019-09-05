const App = require('./spec/app');

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
        logLevel: config.LOG_WARN,
        browsers: [
            'Chrome',
            'PhantomJS'
        ],
        concurrency: Infinity,
        reporters: [
            'spec',
            'coverage'
        ],
        preprocessors: {
            'lib/**/*.js': ['coverage']
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
                },
                {
                    type: 'lcov',
                    subdir: '.'
                }
            ]
        },
        browserDisconnectTimeout: 15000,
        browserNoActivityTimeout: 120000,
        expressHttpServer: {
            port: 8092,
            appVisitor: App
        }
    };

    if (process.env.TRAVIS) {
        params.browsers = [
            'PhantomJS'
        ];
    }

    config.set(params);
};
