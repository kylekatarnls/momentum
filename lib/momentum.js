(function (root, factory) {
    /* istanbul ignore if */
    if (typeof define === "function" && define.amd) {
        define(factory);
    } else /* istanbul ignore if */ if (typeof exports === "object") {
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
