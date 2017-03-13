import { EventEmitter } from 'events';
import * as _ from 'lodash';
import * as Promise from 'bluebird';
import * as debug from 'debug';
import { Stream, User, Model, Group, Layer, Feature, SpanPack } from 'waend-lib';
import Context, { ContextIndex, ContextOrNull, ICommand } from './Context';
import { setenv } from './Env';
import { getBinder } from './Bind';
import { region } from './Region';
import { semaphore } from './Semaphore';
const logger = debug('waend:Shell');


export interface ISys {
    stdin: Stream;
    stdout: Stream;
    stderr: Stream;
}

export interface IEventChangeContext {
    index: ContextIndex;
    path: string[];
}


function getCliChunk(chars: string[], start: number, endChar: string) {
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

function cliSplit(str: string) {
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

// some tests, i keep them around for whatever reason
// var tests = [
//     ['cmd arg', 2],
//     ['cmd arg0 arg1', 3],
//     ['cmd "arg0 arg1"', 2],
//     ['cmd \'"arg0 arg1" arg2\' arg3', 3],
//     ['cmd "\'arg0 arg1 arg2\' arg3" arg4', 3],
//     ['cmd "\'arg0 arg1 arg2\' arg3" "arg4 arg5"', 3],
// ];

// for (var i = 0; i < tests.length; i++) {
//     var str = tests[i][0];
//     var check = tests[i][1];
//     var splitted = split(str)
//     logger('<'+str+'>', check, splitted.length, splitted);
// }


const defaultDescriptor = {
    enumerable: false,
    configurable: false,
    // writable: false
};

const rootModel = new Model({
    id: '00000000-0000-0000-0000-00000000',
    properties: {}
});

export class Shell extends EventEmitter {

    stdin: Stream;
    stdout: Stream;
    stderr: Stream;
    private contexts: [ContextOrNull, ContextOrNull, ContextOrNull, ContextOrNull, ContextOrNull];
    private commands: [ICommand[], ICommand[], ICommand[], ICommand[], ICommand[]];
    private currentContext: ContextIndex;
    private postSwitchCallbacks: Array<(() => void)>
    private user: User | null;
    private previousGroup: string;

    constructor() {
        super();
        this.contexts = [null, null, null, null, null];
        this.commands = [[], [], [], [], []];
        this.contexts[ContextIndex.SHELL] = new Context('root', {
            shell: this,
            data: rootModel,
            parent: null
        });
        this.currentContext = ContextIndex.SHELL;
        this.initStreams();

        semaphore.on('please:shell:context',
            this.switchContext.bind(this));

    }

    setCommands(contextId: ContextIndex, commands: ICommand[]) {
        this.commands[contextId] = commands;
    }



    initStreams() {

        const streams: ISys = {
            stdin: new Stream(),
            stdout: new Stream(),
            stderr: new Stream()
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

    commandLineTokens(cl: string) {
        return cliSplit(cl);
    }


    makePipes(n: number) {
        const pipes: ISys[] = [];

        for (let i = 0; i < n; i++) {
            const sys: ISys = {
                'stdin': (new Stream()),
                'stdout': (new Stream()),
                'stderr': this.stderr
            };
            pipes.push(sys);
        }

        const concentrator: ISys = {
            'stdin': (new Stream()),
            'stdout': (new Stream()),
            'stderr': this.stderr
        };

        const forward: (a: SpanPack) => void =
            (pack) => {
                this.stdout.write(pack);
            }

        pipes.push(concentrator);
        concentrator.stdin.on('data', forward);

        return pipes;
    }

    execOne(cl: string) {
        const toks = this.commandLineTokens(cl.trim());
        const context = this.contexts[this.currentContext];
        if (context) {
            try {
                const sys: ISys = {
                    'stdin': this.stdin,
                    'stdout': this.stdout,
                    'stderr': this.stderr
                };

                return context.exec(sys, toks)
                    .then(result => {
                        setenv('DELIVERED', result);
                        return Promise.resolve(result);
                    });
            }
            catch (err) {
                setenv('DELIVERED', new Error(err));
                return Promise.reject(err);
            }
        }
        return Promise.reject(new Error('ContextFailed'));
    }

    execMany(cls: string[]) {
        const context = this.contexts[this.currentContext];
        const pipes = this.makePipes(cls.length);

        if (context) {

            const pipeStreams: (a: ISys, b: ISys) => void =
                (left, right) => {

                    left.stdout.on('data', (pack: SpanPack) => {
                        right.stdin.write(pack);
                    });

                    left.stdin.on('data', (pack: SpanPack) => {
                        right.stdout.write(pack);
                    });
                };

            return Promise.reduce(cls, (total, _item, index) => {
                setenv('DELIVERED', total);
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

    exec(cl: string) {
        const cls = cl.trim().split('|');
        // shall be called, but not doing it exposes weaknesses, which is good at this stage
        // this.stdin.dump();
        // this.stdout.dump();
        // this.stderr.dump();
        setenv('DELIVERED', null);
        if (1 === cls.length) {
            return this.execOne(cls[0]);
        }
        return this.execMany(cls);
    }


    switchContext(pathComps: string[]): Promise<IEventChangeContext> {
        this.postSwitchCallbacks = [];

        // very private
        const clearContexts: () => IEventChangeContext =
            () => {
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

                const event: IEventChangeContext = {
                    path,
                    index: this.currentContext,
                };

                semaphore.signal<IEventChangeContext>('shell:change:context', event);
                return event;
            };


        if (ContextIndex.SHELL === pathComps.length) {
            this.currentContext = ContextIndex.SHELL;
            clearContexts();
            return Promise.resolve({ index: ContextIndex.SHELL, path: [] });
        }
        else if (ContextIndex.USER === pathComps.length) {
            return this.loadUser(pathComps).then(clearContexts);
        }
        else if (ContextIndex.GROUP === pathComps.length) {
            return this.loadGroup(pathComps).then(clearContexts);
        }
        else if (ContextIndex.LAYER === pathComps.length) {
            return this.loadLayer(pathComps).then(clearContexts);
        }
        else if (ContextIndex.FEATURE === pathComps.length) {
            return this.loadFeature(pathComps).then(clearContexts);
        }

        return Promise.reject(new Error('FailedToSwitchContext'));
    }

    getUserId(userName: string) {
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

    setUser(userId: string) {
        return (
            getBinder()
                .getUser(userId)
                .then(userData => {
                    const parent = this.contexts[ContextIndex.SHELL];
                    this.contexts[ContextIndex.USER] = new Context('user', {
                        shell: this,
                        data: userData,
                        parent
                    });
                    this.currentContext = ContextIndex.USER;
                    return Promise.resolve(userData);
                })
                .catch(err => {
                    logger(`setUser: failed to switch context [${userId}]`, err);
                })
        );
    }

    setGroup(groupId: string) {
        const context = this.contexts[ContextIndex.USER];
        if (context) {

            const user = context.data;

            return (
                getBinder()
                    .getGroup(user.id, groupId)
                    .then(groupData => {
                        this.contexts[ContextIndex.GROUP] = new Context("group", {
                            shell: this,
                            data: groupData,
                            parent: this.contexts[ContextIndex.USER]
                        });
                        this.currentContext = ContextIndex.GROUP;
                        if (this.previousGroup !== groupId) {
                            // here we check if a region set should happen
                            this.previousGroup = groupId;
                            if (groupData.has('extent')) {
                                // it should be an array [minx, miny, maxx, maxy];
                                const extent = groupData.get('extent',
                                    region.getWorldExtent().getArray());
                                this.postSwitchCallbacks.push(() => {
                                    semaphore.once('layer:update:complete', () => {
                                        region.push(extent);
                                    });
                                });
                            }
                        }
                        return Promise.resolve(groupData);
                    })
                    .catch(err => {
                        logger(`setGroup: failed to switch context [${groupId}]`, err);
                    })
            );
        }

        return Promise.reject<Group>(new Error("SetGroupNoContext"));
    }

    setLayer(layerId: string) {
        const userContext = this.contexts[ContextIndex.USER];
        const groupContext = this.contexts[ContextIndex.GROUP];

        if (userContext && groupContext) {
            const user = userContext.data;
            const group = groupContext.data;

            return (
                getBinder()
                    .getLayer(user.id, group.id, layerId)
                    .then(layerData => {
                        this.contexts[ContextIndex.LAYER] = new Context("layer", {
                            shell: this,
                            data: layerData,
                            parent: this.contexts[ContextIndex.GROUP]
                        });
                        this.currentContext = ContextIndex.LAYER;
                        return Promise.resolve(layerData);
                    })
                    .catch(err => {
                        logger(`setLayer: failed to switch context [${layerId}]`, err);
                    })
            );
        }
        return Promise.reject<Layer>(new Error("SetLayerNoContext"));
    }

    setFeature(featureId: string) {
        const userContext = this.contexts[ContextIndex.USER];
        const groupContext = this.contexts[ContextIndex.GROUP];
        const layerContext = this.contexts[ContextIndex.LAYER];

        if (userContext && groupContext && layerContext) {

            const user = userContext.data;
            const group = groupContext.data;
            const layer = layerContext.data;

            return (
                getBinder()
                    .getFeature(user.id, group.id, layer.id, featureId)
                    .then(featureData => {
                        this.contexts[ContextIndex.FEATURE] = new Context("feature", {
                            shell: this,
                            data: featureData,
                            parent: this.contexts[ContextIndex.LAYER]
                        });
                        this.currentContext = ContextIndex.FEATURE;
                        return Promise.resolve(featureData);
                    })
                    .catch(err => {
                        logger(`setFeature: failed to switch context [${featureId}]`, err);
                    })
            );
        }
        return Promise.reject<Feature>(new Error("SetFeatureNoContext"));
    }

    loadUser(path: string[]) {
        try {
            const userName = this.getUserId(path[0]);
            return this.setUser(userName);
        }
        catch (err) {
            return Promise.reject<User>('invalid user id');
        }

    }

    loadGroup(path: string[]) {
        const userName = this.getUserId(path[0]);
        const groupName = path[1];

        return this.setUser(userName)
            .then(() => this.setGroup(groupName));
    }

    loadLayer(path: string[]) {
        const userName = this.getUserId(path[0]);
        const groupName = path[1];
        const layerName = path[2];

        return this.setUser(userName)
            .then(() => this.setGroup(groupName))
            .then(() => this.setLayer(layerName));
    }

    loadFeature(path: string[]) {
        const userName = this.getUserId(path[0]);
        const groupName = path[1];
        const layerName = path[2];
        const featureName = path[3];

        return this.setUser(userName)
            .then(() => this.setGroup(groupName))
            .then(() => this.setLayer(layerName))
            .then(() => this.setFeature(featureName));
    }

    loginUser(u: User) {
        this.user = u;
        semaphore.signal('user:login', u);
    }

    logoutUser() {
        this.user = null;
        semaphore.signal<void>('user:logout');
    }

}


export default Shell;
