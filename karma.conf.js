module.exports = config => {
    config.set({
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
        coverageReporter: {
            type : 'html',
            dir : 'coverage/'
        }
    });
};
