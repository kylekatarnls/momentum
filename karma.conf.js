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
        logLevel: config.LOG_INFO,
        browsers: [
            'Chrome',
            'PhantomJS'
        ],
        concurrency: Infinity,
        reporters: [
            'jasmine-diff',
            'progress',
            'coverage'
        ],
        jasmineDiffReporter: {
            pretty: 4,
            multiline: true,
            color: {
                expectedBg: 'red',
                expectedWhitespaceBg: 'red',
                actualBg: 'green',
                actualWhitespaceBg: 'green'
            }
        },
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
        browserDisconnectTimeout: 15000,
        browserNoActivityTimeout: 120000,
        expressHttpServer: {
            port: 8092,
            appVisitor: App
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
