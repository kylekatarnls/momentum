module.exports = config => {
    const params = {
        basePath: '',
        frameworks: ['jasmine'],
        files: [
            'lib/**/*.js'
        ],
        colors: true,
        singleRun: true,
        logLevel: config.LOG_INFO,
        browsers: ['Chrome', 'PhantomJS'],
        concurrency: Infinity,
        reporters: ['progress', 'coverage'],
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
            type : 'html',
            dir : 'coverage/'
        }
    };

    if (process.env.TRAVIS) {
        params.browsers = ['ChromeTravisCI', 'PhantomJS'];
    }

    config.set(params);
};
