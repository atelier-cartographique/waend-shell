"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const store = {};
exports.set = function (key, value) {
    const getter = () => value;
    store[key] = getter;
    return getter;
};
exports.get = function (key, def) {
    if (key in store) {
        return store[key]();
    }
    if (def) {
        return def;
    }
    return null;
};
exports.default = { set: exports.set, get: exports.get };
//# sourceMappingURL=Env.js.map