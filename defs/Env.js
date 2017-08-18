"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var store = {};
exports.setenv = function (key, value) {
    var getter = function () { return value; };
    store[key] = getter;
    return getter;
};
exports.getenv = function (key, def) {
    if (key in store) {
        return store[key]();
    }
    if (def) {
        return def;
    }
    return null;
};
exports.default = { setenv: exports.setenv, getenv: exports.getenv };
