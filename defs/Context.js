"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var EventEmitter = require("events");
var path_1 = require("path");
var _ = require("lodash");
var Promise = require("bluebird");
var Bind_1 = require("./Bind");
var ContextIndex;
(function (ContextIndex) {
    ContextIndex[ContextIndex["SHELL"] = 0] = "SHELL";
    ContextIndex[ContextIndex["USER"] = 1] = "USER";
    ContextIndex[ContextIndex["GROUP"] = 2] = "GROUP";
    ContextIndex[ContextIndex["LAYER"] = 3] = "LAYER";
    ContextIndex[ContextIndex["FEATURE"] = 4] = "FEATURE";
})(ContextIndex = exports.ContextIndex || (exports.ContextIndex = {}));
var findCommand = function (cs, cmdName) {
    for (var i = 0; i < cs.length; i += 1) {
        if (cs[i].name === cmdName) {
            return cs[i];
        }
    }
    return null;
};
var Context = (function (_super) {
    __extends(Context, _super);
    function Context(name, options) {
        var _this = _super.call(this) || this;
        _this.name = name;
        _this.shell = options.shell;
        _this.data = options.data;
        _this.commands = options.commands;
        _this.parent = options.parent;
        _this.binder = Bind_1.getBinder();
        var computeCurrent = function (ctx, acc) {
            if (ctx.parent) {
                return computeCurrent(ctx.parent, [ctx.data.id].concat(acc));
            }
            return acc;
        };
        _this.current = computeCurrent(_this, []);
        return _this;
    }
    Context.prototype.exec = function (sys, tokens) {
        if (tokens.length > 0) {
            var cmd = tokens[0];
            var argv = tokens.slice(1);
            var commands = this.commands;
            var ctx = this;
            var com = findCommand(commands, cmd);
            if (com) {
                return com.command(ctx, sys, argv);
            }
            else if (this.parent) {
                return this.parent.exec(sys, tokens);
            }
            return Promise.reject(new Error("command not found: " + cmd));
        }
        return Promise.reject(new Error("null command"));
    };
    Context.prototype.getUser = function () {
        var cur = this.current;
        if (cur.length > 0) {
            return cur[0];
        }
        return null;
    };
    Context.prototype.getGroup = function () {
        var cur = this.current;
        if (cur.length > 1) {
            return cur[1];
        }
        return null;
    };
    Context.prototype.getLayer = function () {
        var cur = this.current;
        if (cur.length > 2) {
            return cur[2];
        }
        return null;
    };
    Context.prototype.getFeature = function () {
        var cur = this.current;
        if (cur.length > 3) {
            return cur[3];
        }
        return null;
    };
    Context.prototype.resolve = function () {
        var pathSegments = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            pathSegments[_i] = arguments[_i];
        }
        var contextPath = path_1.resolve.apply(void 0, ['/'].concat(this.current));
        return path_1.resolve.apply(void 0, [contextPath].concat(pathSegments));
    };
    Context.prototype.end = function (ret) {
        if (_.isFunction(ret)) {
            var resolver = ret;
            return (new Promise(resolver));
        }
        return Promise.resolve(ret);
    };
    Context.prototype.endWithError = function (err) {
        return Promise.reject(err);
    };
    return Context;
}(EventEmitter));
exports.Context = Context;
