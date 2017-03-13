"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const EventEmitter = require("events");
const _ = require("lodash");
const Promise = require("bluebird");
const Bind_1 = require("./Bind");
var ContextIndex;
(function (ContextIndex) {
    ContextIndex[ContextIndex["SHELL"] = 0] = "SHELL";
    ContextIndex[ContextIndex["USER"] = 1] = "USER";
    ContextIndex[ContextIndex["GROUP"] = 2] = "GROUP";
    ContextIndex[ContextIndex["LAYER"] = 3] = "LAYER";
    ContextIndex[ContextIndex["FEATURE"] = 4] = "FEATURE";
})(ContextIndex = exports.ContextIndex || (exports.ContextIndex = {}));
class Context extends EventEmitter {
    constructor(name, options) {
        super();
        this.name = name;
        this.shell = options.shell;
        this.data = options.data;
        this.parent = options.parent;
        const computeCurrent = (ctx, acc) => {
            if (ctx.parent) {
                return computeCurrent(ctx.parent, acc);
            }
            return acc.concat([ctx.data.id]);
        };
        this.current = computeCurrent(this, []);
    }
    exec(sys, tokens) {
        const cmd = tokens.shift();
        if (cmd) {
            const commands = this.commands;
            const finder = (c) => c.name === cmd;
            const com = commands.find(finder);
            if (com) {
                return com.command.call(this, sys, ...tokens);
            }
            else if (this.parent) {
                return this.parent.exec(sys, tokens);
            }
            return Promise.reject(new Error(`command not found: ${cmd}`));
        }
        return Promise.reject(new Error(`null command`));
    }
    getUser() {
        const cur = this.current;
        if (cur.length > 0) {
            return cur[0];
        }
        return null;
    }
    getGroup() {
        const cur = this.current;
        if (cur.length > 1) {
            return cur[1];
        }
        return null;
    }
    getLayer() {
        const cur = this.current;
        if (cur.length > 2) {
            return cur[2];
        }
        return null;
    }
    getFeature() {
        const cur = this.current;
        if (cur.length > 3) {
            return cur[3];
        }
        return null;
    }
    end(ret) {
        if (_.isFunction(ret)) {
            const resolver = ret;
            return (new Promise(resolver));
        }
        return Promise.resolve(ret);
    }
    endWithError(err) {
        return Promise.reject(err);
    }
}
Context.binder = Bind_1.getBinder();
exports.default = Context;
//# sourceMappingURL=Context.js.map