/// <reference types="node" />
/// <reference types="bluebird" />
import { EventEmitter } from 'events';
import * as Promise from 'bluebird';
import { Stream, User, Group, Layer, Feature } from 'waend-lib';
import { ContextIndex, ICommand } from './Context';
export interface ISys {
    stdin: Stream;
    stdout: Stream;
    stderr: Stream;
}
export interface IEventChangeContext {
    index: ContextIndex;
    path: string[];
}
export declare class Shell extends EventEmitter {
    stdin: Stream;
    stdout: Stream;
    stderr: Stream;
    private contexts;
    private commands;
    private currentContext;
    private postSwitchCallbacks;
    private user;
    private previousGroup;
    constructor();
    setCommands(contextId: ContextIndex, commands: ICommand[]): void;
    initStreams(): void;
    commandLineTokens(cl: string): string[];
    makePipes(n: number): ISys[];
    execOne(cl: string): Promise<any>;
    execMany(cls: string[]): Promise<any>;
    exec(cl: string): Promise<any>;
    switchContext(pathComps: string[]): Promise<IEventChangeContext>;
    getUserId(userName: string): string;
    getUser(): User | null;
    setUser(userId: string): Promise<User>;
    setGroup(groupId: string): Promise<Group>;
    setLayer(layerId: string): Promise<Layer>;
    setFeature(featureId: string): Promise<Feature>;
    loadUser(path: string[]): Promise<User>;
    loadGroup(path: string[]): Promise<Group>;
    loadLayer(path: string[]): Promise<Layer>;
    loadFeature(path: string[]): Promise<Feature>;
    loginUser(u: User): void;
    logoutUser(): void;
}
export default Shell;
