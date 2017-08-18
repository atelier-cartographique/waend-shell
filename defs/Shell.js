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
var events_1 = require("events");
var _ = require("lodash");
var Promise = require("bluebird");
var debug = require("debug");
var waend_lib_1 = require("waend-lib");
var Context_1 = require("./Context");
var Env_1 = require("./Env");
var Bind_1 = require("./Bind");
var Region_1 = require("./Region");
var Semaphore_1 = require("./Semaphore");
var logger = debug('waend:Shell');
function getCliChunk(chars, start, endChar) {
    var chunk = '';
    for (var i = start; i < chars.length; i++) {
        var c = chars[i];
        if (endChar === c) {
            break;
        }
        chunk += c;
    }
    return chunk;
}
function cliSplit(str) {
    var chars = str.trim().split('');
    var ret = [];
    for (var i = 0; i < chars.length; i++) {
        var c = chars[i];
        var chunk = void 0;
        if ('"' === c) {
            chunk = getCliChunk(chars, i + 1, '"');
            i += chunk.length + 1;
            ret.push(chunk);
        }
        else if ("'" === c) {
            chunk = getCliChunk(chars, i + 1, "'");
            i += chunk.length + 1;
            ret.push(chunk);
        }
        else if (' ' !== c) {
            chunk = getCliChunk(chars, i, ' ');
            i += chunk.length;
            ret.push(chunk);
        }
    }
    return ret;
}
var defaultDescriptor = {
    enumerable: false,
    configurable: false,
};
var rootModel = new waend_lib_1.Model({
    id: '',
    properties: {}
});
var Shell = (function (_super) {
    __extends(Shell, _super);
    function Shell(commands) {
        var _this = _super.call(this) || this;
        _this.commands = commands;
        _this.contexts = [null, null, null, null, null];
        _this.contexts[Context_1.ContextIndex.SHELL] = new Context_1.Context('root', {
            shell: _this,
            data: rootModel,
            parent: null,
            commands: _this.commands[Context_1.ContextIndex.SHELL],
        });
        _this.currentContext = Context_1.ContextIndex.SHELL;
        _this.initStreams();
        Semaphore_1.semaphore.on('please:shell:context', _this.switchContext.bind(_this));
        return _this;
    }
    Shell.prototype.addCommand = function (contextId, command) {
        this.commands[contextId].push(command);
    };
    Shell.prototype.initStreams = function () {
        var streams = {
            stdin: new waend_lib_1.Stream(),
            stdout: new waend_lib_1.Stream(),
            stderr: new waend_lib_1.Stream()
        };
        Object.defineProperty(this, 'stdin', _.defaults({
            get: function () {
                return streams.stdin;
            },
        }, defaultDescriptor));
        Object.defineProperty(this, 'stdout', _.defaults({
            get: function () {
                return streams.stdout;
            },
        }, defaultDescriptor));
        Object.defineProperty(this, 'stderr', _.defaults({
            get: function () {
                return streams.stderr;
            },
        }, defaultDescriptor));
    };
    Shell.prototype.commandLineTokens = function (cl) {
        return cliSplit(cl);
    };
    Shell.prototype.makePipes = function (n) {
        var _this = this;
        var pipes = [];
        for (var i = 0; i < n; i++) {
            var sys = {
                'stdin': (new waend_lib_1.Stream()),
                'stdout': (new waend_lib_1.Stream()),
                'stderr': this.stderr
            };
            pipes.push(sys);
        }
        var concentrator = {
            'stdin': (new waend_lib_1.Stream()),
            'stdout': (new waend_lib_1.Stream()),
            'stderr': this.stderr
        };
        var forward = function (pack) {
            _this.stdout.write(pack);
        };
        pipes.push(concentrator);
        concentrator.stdin.on('data', forward);
        return pipes;
    };
    Shell.prototype.execOne = function (cl) {
        var toks = this.commandLineTokens(cl.trim());
        var context = this.contexts[this.currentContext];
        if (context) {
            try {
                var sys = {
                    'stdin': this.stdin,
                    'stdout': this.stdout,
                    'stderr': this.stderr
                };
                return context.exec(sys, toks)
                    .then(function (result) {
                    Env_1.setenv('DELIVERED', result);
                    return Promise.resolve(result);
                });
            }
            catch (err) {
                Env_1.setenv('DELIVERED', new Error(err));
                return Promise.reject(err);
            }
        }
        return Promise.reject(new Error('ContextFailed'));
    };
    Shell.prototype.execMany = function (cls) {
        var _this = this;
        var context = this.contexts[this.currentContext];
        var pipes = this.makePipes(cls.length);
        if (context) {
            var pipeStreams_1 = function (left, right) {
                left.stdout.on('data', function (pack) {
                    right.stdin.write(pack);
                });
                left.stdin.on('data', function (pack) {
                    right.stdout.write(pack);
                });
            };
            return Promise.reduce(cls, function (total, _item, index) {
                Env_1.setenv('DELIVERED', total);
                var cl = cls[index].trim();
                var toks = _this.commandLineTokens(cl);
                var sys = pipes[index];
                var nextSys = pipes[index + 1];
                pipeStreams_1(sys, nextSys);
                return context.exec(sys, toks);
            }, 0);
        }
        return Promise.reject(new Error('ContextFailed'));
    };
    Shell.prototype.exec = function (cl) {
        var cls = cl.trim().split('|');
        Env_1.setenv('DELIVERED', null);
        if (1 === cls.length) {
            return this.execOne(cls[0]);
        }
        return this.execMany(cls);
    };
    Shell.prototype.switchContext = function (pathComps) {
        var _this = this;
        this.postSwitchCallbacks = [];
        var clearContexts = function () {
            var start = _this.currentContext + 1;
            var i;
            for (i = start; i < _this.contexts.length; i++) {
                _this.contexts[i] = null;
            }
            var path = [];
            for (i = 1; i < start; i++) {
                var context = _this.contexts[i];
                if (!context) {
                    break;
                }
                path.push(context.data.id);
            }
            for (i = 0; i < _this.postSwitchCallbacks.length; i++) {
                var cb = _this.postSwitchCallbacks[i];
                cb();
            }
            var event = {
                path: path,
                index: _this.currentContext,
            };
            Semaphore_1.semaphore.signal('shell:change:context', event);
            return event;
        };
        if (Context_1.ContextIndex.SHELL === pathComps.length) {
            this.currentContext = Context_1.ContextIndex.SHELL;
            clearContexts();
            return Promise.resolve({ index: Context_1.ContextIndex.SHELL, path: [] });
        }
        else if (Context_1.ContextIndex.USER === pathComps.length) {
            return this.loadUser(pathComps).then(clearContexts);
        }
        else if (Context_1.ContextIndex.GROUP === pathComps.length) {
            return this.loadGroup(pathComps).then(clearContexts);
        }
        else if (Context_1.ContextIndex.LAYER === pathComps.length) {
            return this.loadLayer(pathComps).then(clearContexts);
        }
        else if (Context_1.ContextIndex.FEATURE === pathComps.length) {
            return this.loadFeature(pathComps).then(clearContexts);
        }
        return Promise.reject(new Error('FailedToSwitchContext'));
    };
    Shell.prototype.getUserId = function (userName) {
        if ('me' === userName) {
            if (this.user) {
                return this.user.id;
            }
            throw (new Error("you're not logged in"));
        }
        return userName;
    };
    Shell.prototype.getUser = function () {
        return this.user;
    };
    Shell.prototype.setUser = function (userId) {
        var _this = this;
        return (Bind_1.getBinder()
            .getUser(userId)
            .then(function (userData) {
            var parent = _this.contexts[Context_1.ContextIndex.SHELL];
            _this.contexts[Context_1.ContextIndex.USER] = new Context_1.Context('user', {
                shell: _this,
                data: userData,
                commands: _this.commands[Context_1.ContextIndex.USER],
                parent: parent
            });
            _this.currentContext = Context_1.ContextIndex.USER;
            return Promise.resolve(userData);
        })
            .catch(function (err) {
            logger("setUser: failed to switch context [" + userId + "]", err);
        }));
    };
    Shell.prototype.setGroup = function (groupId) {
        var _this = this;
        var context = this.contexts[Context_1.ContextIndex.USER];
        if (context) {
            var user = context.data;
            return (Bind_1.getBinder()
                .getGroup(user.id, groupId)
                .then(function (groupData) {
                _this.contexts[Context_1.ContextIndex.GROUP] = new Context_1.Context("group", {
                    shell: _this,
                    data: groupData,
                    parent: _this.contexts[Context_1.ContextIndex.USER],
                    commands: _this.commands[Context_1.ContextIndex.GROUP],
                });
                _this.currentContext = Context_1.ContextIndex.GROUP;
                if (_this.previousGroup !== groupId) {
                    _this.previousGroup = groupId;
                    if (groupData.has('extent')) {
                        var extent_1 = groupData.get('extent', Region_1.Region.getWorldExtent().getArray());
                        _this.postSwitchCallbacks.push(function () {
                            Semaphore_1.semaphore.once('layer:update:complete', function () {
                                Region_1.region.push(extent_1);
                            });
                        });
                    }
                }
                return Promise.resolve(groupData);
            })
                .catch(function (err) {
                logger("setGroup: failed to switch context [" + groupId + "]", err);
            }));
        }
        return Promise.reject(new Error("SetGroupNoContext"));
    };
    Shell.prototype.setLayer = function (layerId) {
        var _this = this;
        var userContext = this.contexts[Context_1.ContextIndex.USER];
        var groupContext = this.contexts[Context_1.ContextIndex.GROUP];
        if (userContext && groupContext) {
            var user = userContext.data;
            var group = groupContext.data;
            return (Bind_1.getBinder()
                .getLayer(user.id, group.id, layerId)
                .then(function (layerData) {
                _this.contexts[Context_1.ContextIndex.LAYER] = new Context_1.Context("layer", {
                    shell: _this,
                    data: layerData,
                    parent: _this.contexts[Context_1.ContextIndex.GROUP],
                    commands: _this.commands[Context_1.ContextIndex.LAYER],
                });
                _this.currentContext = Context_1.ContextIndex.LAYER;
                return Promise.resolve(layerData);
            })
                .catch(function (err) {
                logger("setLayer: failed to switch context [" + layerId + "]", err);
            }));
        }
        return Promise.reject(new Error("SetLayerNoContext"));
    };
    Shell.prototype.setFeature = function (featureId) {
        var _this = this;
        var userContext = this.contexts[Context_1.ContextIndex.USER];
        var groupContext = this.contexts[Context_1.ContextIndex.GROUP];
        var layerContext = this.contexts[Context_1.ContextIndex.LAYER];
        if (userContext && groupContext && layerContext) {
            var user = userContext.data;
            var group = groupContext.data;
            var layer = layerContext.data;
            return (Bind_1.getBinder()
                .getFeature(user.id, group.id, layer.id, featureId)
                .then(function (featureData) {
                _this.contexts[Context_1.ContextIndex.FEATURE] = new Context_1.Context("feature", {
                    shell: _this,
                    data: featureData,
                    parent: _this.contexts[Context_1.ContextIndex.LAYER],
                    commands: _this.commands[Context_1.ContextIndex.FEATURE],
                });
                _this.currentContext = Context_1.ContextIndex.FEATURE;
                return Promise.resolve(featureData);
            })
                .catch(function (err) {
                logger("setFeature: failed to switch context [" + featureId + "]", err);
            }));
        }
        return Promise.reject(new Error("SetFeatureNoContext"));
    };
    Shell.prototype.loadUser = function (path) {
        try {
            var userName = this.getUserId(path[0]);
            return this.setUser(userName);
        }
        catch (err) {
            return Promise.reject('invalid user id');
        }
    };
    Shell.prototype.loadGroup = function (path) {
        var _this = this;
        var userName = this.getUserId(path[0]);
        var groupName = path[1];
        return this.setUser(userName)
            .then(function () { return _this.setGroup(groupName); });
    };
    Shell.prototype.loadLayer = function (path) {
        var _this = this;
        var userName = this.getUserId(path[0]);
        var groupName = path[1];
        var layerName = path[2];
        return this.setUser(userName)
            .then(function () { return _this.setGroup(groupName); })
            .then(function () { return _this.setLayer(layerName); });
    };
    Shell.prototype.loadFeature = function (path) {
        var _this = this;
        var userName = this.getUserId(path[0]);
        var groupName = path[1];
        var layerName = path[2];
        var featureName = path[3];
        return this.setUser(userName)
            .then(function () { return _this.setGroup(groupName); })
            .then(function () { return _this.setLayer(layerName); })
            .then(function () { return _this.setFeature(featureName); });
    };
    Shell.prototype.loginUser = function (u) {
        this.user = u;
        Semaphore_1.semaphore.signal('user:login', u);
    };
    Shell.prototype.logoutUser = function () {
        this.user = null;
        Semaphore_1.semaphore.signal('user:logout');
    };
    return Shell;
}(events_1.EventEmitter));
exports.Shell = Shell;
exports.default = Shell;
