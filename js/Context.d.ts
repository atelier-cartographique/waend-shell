/// <reference types="bluebird" />
/// <reference types="node" />
import * as EventEmitter from 'events';
import * as Promise from 'bluebird';
import { Shell, ISys } from './index';
import { Model } from 'waend-lib';
import { Bind } from './Bind';
export declare type IContextEndResolver<T> = (resolve: (a: T) => void, reject: (a: Error) => void) => void;
export interface ContextOptions {
    shell: Shell;
    data: Model;
    parent: ContextOrNull;
}
export declare enum ContextIndex {
    SHELL = 0,
    USER = 1,
    GROUP = 2,
    LAYER = 3,
    FEATURE = 4,
}
export interface ICommand {
    name: string;
    command: (ctx: Context, sys: ISys, args: string[]) => Promise<any>;
}
export declare type ContextOrNull = Context | null;
export declare class Context extends EventEmitter {
    binder: Bind;
    shell: Shell;
    readonly name: string;
    readonly data: Model;
    readonly current: string[];
    readonly parent: ContextOrNull;
    protected commands: ICommand[];
    constructor(name: string, options: ContextOptions);
    exec(sys: ISys, tokens: string[]): Promise<any>;
    getUser(): string | null;
    getGroup(): string | null;
    getLayer(): string | null;
    getFeature(): string | null;
    resolve(...pathSegments: string[]): string;
    end<T>(ret: IContextEndResolver<T> | T): Promise<T>;
    endWithError<T>(err: Error): Promise<T>;
}
