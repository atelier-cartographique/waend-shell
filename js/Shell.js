"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const _ = require("lodash");
const Promise = require("bluebird");
const debug = require("debug");
const waend_lib_1 = require("waend-lib");
const Context_1 = require("./Context");
const Env_1 = require("./Env");
const Bind_1 = require("./Bind");
const Region_1 = require("./Region");
const Semaphore_1 = require("./Semaphore");
const logger = debug('waend:Shell');
function getCliChunk(chars, start, endChar) {
    let chunk = '';
    for (let i = start; i < chars.length; i++) {
        const c = chars[i];
        if (endChar === c) {
            break;
        }
        chunk += c;
    }
    return chunk;
}
function cliSplit(str) {
    const chars = str.trim().split('');
    const ret = [];
    for (let i = 0; i < chars.length; i++) {
        const c = chars[i];
        let chunk;
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
const defaultDescriptor = {
    enumerable: false,
    configurable: false,
};
const rootModel = new waend_lib_1.Model({
    id: '00000000-0000-0000-0000-00000000',
    properties: {}
});
class Shell extends events_1.EventEmitter {
    constructor() {
        super();
        this.contexts = [null, null, null, null, null];
        this.commands = [[], [], [], [], []];
        this.contexts[Context_1.ContextIndex.SHELL] = new Context_1.default('root', {
            shell: this,
            data: rootModel,
            parent: null
        });
        this.currentContext = Context_1.ContextIndex.SHELL;
        this.initStreams();
        Semaphore_1.default.on('please:shell:context', this.switchContext.bind(this));
    }
    setCommands(contextId, commands) {
        this.commands[contextId] = commands;
    }
    initStreams() {
        const streams = {
            stdin: new waend_lib_1.Stream(),
            stdout: new waend_lib_1.Stream(),
            stderr: new waend_lib_1.Stream()
        };
        Object.defineProperty(this, 'stdin', _.defaults({
            get() {
                return streams.stdin;
            },
        }, defaultDescriptor));
        Object.defineProperty(this, 'stdout', _.defaults({
            get() {
                return streams.stdout;
            },
        }, defaultDescriptor));
        Object.defineProperty(this, 'stderr', _.defaults({
            get() {
                return streams.stderr;
            },
        }, defaultDescriptor));
    }
    commandLineTokens(cl) {
        return cliSplit(cl);
    }
    makePipes(n) {
        const pipes = [];
        for (let i = 0; i < n; i++) {
            const sys = {
                'stdin': (new waend_lib_1.Stream()),
                'stdout': (new waend_lib_1.Stream()),
                'stderr': this.stderr
            };
            pipes.push(sys);
        }
        const concentrator = {
            'stdin': (new waend_lib_1.Stream()),
            'stdout': (new waend_lib_1.Stream()),
            'stderr': this.stderr
        };
        const forward = (pack) => {
            this.stdout.write(pack);
        };
        pipes.push(concentrator);
        concentrator.stdin.on('data', forward);
        return pipes;
    }
    execOne(cl) {
        const toks = this.commandLineTokens(cl.trim());
        const context = this.contexts[this.currentContext];
        if (context) {
            try {
                const sys = {
                    'stdin': this.stdin,
                    'stdout': this.stdout,
                    'stderr': this.stderr
                };
                return context.exec(sys, toks)
                    .then(result => {
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
    }
    execMany(cls) {
        const context = this.contexts[this.currentContext];
        const pipes = this.makePipes(cls.length);
        if (context) {
            const pipeStreams = (left, right) => {
                left.stdout.on('data', (pack) => {
                    right.stdin.write(pack);
                });
                left.stdin.on('data', (pack) => {
                    right.stdout.write(pack);
                });
            };
            return Promise.reduce(cls, (total, _item, index) => {
                Env_1.setenv('DELIVERED', total);
                const cl = cls[index].trim();
                const toks = this.commandLineTokens(cl);
                const sys = pipes[index];
                const nextSys = pipes[index + 1];
                pipeStreams(sys, nextSys);
                return context.exec(sys, toks);
            }, 0);
        }
        return Promise.reject(new Error('ContextFailed'));
    }
    exec(cl) {
        const cls = cl.trim().split('|');
        Env_1.setenv('DELIVERED', null);
        if (1 === cls.length) {
            return this.execOne(cls[0]);
        }
        return this.execMany(cls);
    }
    switchContext(pathComps) {
        this.postSwitchCallbacks = [];
        const clearContexts = () => {
            const start = this.currentContext + 1;
            let i;
            for (i = start; i < this.contexts.length; i++) {
                this.contexts[i] = null;
            }
            const path = [];
            for (i = 1; i < start; i++) {
                const context = this.contexts[i];
                if (!context) {
                    break;
                }
                path.push(context.data.id);
            }
            for (i = 0; i < this.postSwitchCallbacks.length; i++) {
                const cb = this.postSwitchCallbacks[i];
                cb();
            }
            const event = {
                path,
                index: this.currentContext,
            };
            Semaphore_1.default.signal('shell:change:context', event);
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
    }
    getUserId(userName) {
        if ('me' === userName) {
            if (this.user) {
                return this.user.id;
            }
            throw (new Error("you're not logged in"));
        }
        return userName;
    }
    getUser() {
        return this.user;
    }
    setUser(userId) {
        return (Bind_1.getBinder()
            .getUser(userId)
            .then(userData => {
            const parent = this.contexts[Context_1.ContextIndex.SHELL];
            this.contexts[Context_1.ContextIndex.USER] = new Context_1.default('user', {
                shell: this,
                data: userData,
                parent
            });
            this.currentContext = Context_1.ContextIndex.USER;
            return Promise.resolve(userData);
        })
            .catch(err => {
            logger(`setUser: failed to switch context [${userId}]`, err);
        }));
    }
    setGroup(groupId) {
        const context = this.contexts[Context_1.ContextIndex.USER];
        if (context) {
            const user = context.data;
            return (Bind_1.getBinder()
                .getGroup(user.id, groupId)
                .then(groupData => {
                this.contexts[Context_1.ContextIndex.GROUP] = new Context_1.default("group", {
                    shell: this,
                    data: groupData,
                    parent: this.contexts[Context_1.ContextIndex.USER]
                });
                this.currentContext = Context_1.ContextIndex.GROUP;
                if (this.previousGroup !== groupId) {
                    this.previousGroup = groupId;
                    if (groupData.has('extent')) {
                        const extent = groupData.get('extent', Region_1.default.getWorldExtent().getArray());
                        this.postSwitchCallbacks.push(() => {
                            Semaphore_1.default.once('layer:update:complete', () => {
                                Region_1.default.push(extent);
                            });
                        });
                    }
                }
                return Promise.resolve(groupData);
            })
                .catch(err => {
                logger(`setGroup: failed to switch context [${groupId}]`, err);
            }));
        }
        return Promise.reject(new Error("SetGroupNoContext"));
    }
    setLayer(layerId) {
        const userContext = this.contexts[Context_1.ContextIndex.USER];
        const groupContext = this.contexts[Context_1.ContextIndex.GROUP];
        if (userContext && groupContext) {
            const user = userContext.data;
            const group = groupContext.data;
            return (Bind_1.getBinder()
                .getLayer(user.id, group.id, layerId)
                .then(layerData => {
                this.contexts[Context_1.ContextIndex.LAYER] = new Context_1.default("layer", {
                    shell: this,
                    data: layerData,
                    parent: this.contexts[Context_1.ContextIndex.GROUP]
                });
                this.currentContext = Context_1.ContextIndex.LAYER;
                return Promise.resolve(layerData);
            })
                .catch(err => {
                logger(`setLayer: failed to switch context [${layerId}]`, err);
            }));
        }
        return Promise.reject(new Error("SetLayerNoContext"));
    }
    setFeature(featureId) {
        const userContext = this.contexts[Context_1.ContextIndex.USER];
        const groupContext = this.contexts[Context_1.ContextIndex.GROUP];
        const layerContext = this.contexts[Context_1.ContextIndex.LAYER];
        if (userContext && groupContext && layerContext) {
            const user = userContext.data;
            const group = groupContext.data;
            const layer = layerContext.data;
            return (Bind_1.getBinder()
                .getFeature(user.id, group.id, layer.id, featureId)
                .then(featureData => {
                this.contexts[Context_1.ContextIndex.FEATURE] = new Context_1.default("feature", {
                    shell: this,
                    data: featureData,
                    parent: this.contexts[Context_1.ContextIndex.LAYER]
                });
                this.currentContext = Context_1.ContextIndex.FEATURE;
                return Promise.resolve(featureData);
            })
                .catch(err => {
                logger(`setFeature: failed to switch context [${featureId}]`, err);
            }));
        }
        return Promise.reject(new Error("SetFeatureNoContext"));
    }
    loadUser(path) {
        try {
            const userName = this.getUserId(path[0]);
            return this.setUser(userName);
        }
        catch (err) {
            return Promise.reject('invalid user id');
        }
    }
    loadGroup(path) {
        const userName = this.getUserId(path[0]);
        const groupName = path[1];
        return this.setUser(userName)
            .then(() => this.setGroup(groupName));
    }
    loadLayer(path) {
        const userName = this.getUserId(path[0]);
        const groupName = path[1];
        const layerName = path[2];
        return this.setUser(userName)
            .then(() => this.setGroup(groupName))
            .then(() => this.setLayer(layerName));
    }
    loadFeature(path) {
        const userName = this.getUserId(path[0]);
        const groupName = path[1];
        const layerName = path[2];
        const featureName = path[3];
        return this.setUser(userName)
            .then(() => this.setGroup(groupName))
            .then(() => this.setLayer(layerName))
            .then(() => this.setFeature(featureName));
    }
    loginUser(u) {
        this.user = u;
        Semaphore_1.default.signal('user:login', u);
    }
    logoutUser() {
        this.user = null;
        Semaphore_1.default.signal('user:logout');
    }
}
exports.Shell = Shell;
exports.default = Shell;
//# sourceMappingURL=Shell.js.map