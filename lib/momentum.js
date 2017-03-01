(function (root, factory) {
    if (typeof define === "function" && define.amd) {
        /* istanbul ignore next */
        define(factory);
    } else if (typeof exports === "object") {
        /* istanbul ignore next */
        module.exports = factory();
    } else {
        root.Momentum = factory();
    }
}(this, function () {
    /* istanbul ignore if */
    if (typeof window === "undefined") {
        return null;
    }

    return 'Momentum';
}));
