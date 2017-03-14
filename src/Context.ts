/*
 * app/lib/Context.js
 *
 *
 * Copyright (C) 2015  Pierre Marchand <pierremarc07@gmail.com>
 *
 * License in LICENSE file at the root of the repository.
 *
 */


import * as EventEmitter from 'events';
import * as _ from 'lodash';
import * as Promise from 'bluebird';
import { Shell, ISys } from './index';
import { Model } from 'waend-lib';
import { Bind, getBinder } from './Bind';

// import * as debug from 'debug';
// const logger = debug('waend:Context');

export type IContextEndResolver<T> = (resolve: (a: T) => void, reject: (a: Error) => void) => void;

export interface ContextOptions {
    shell: Shell;
    data: Model;
    parent: ContextOrNull;
}

export enum ContextIndex {
    SHELL = 0,
    USER,
    GROUP,
    LAYER,
    FEATURE,
}

export interface ICommand {
    name: string;
    command: (ctx: Context, sys: ISys, args: string[]) => Promise<any>;
}


export type ContextOrNull = Context | null;

export default class Context extends EventEmitter {

    public static binder: Bind = getBinder();
    public shell: Shell;

    readonly name: string;
    readonly data: Model;
    readonly current: string[];
    readonly parent: ContextOrNull;

    protected commands: ICommand[];

    constructor(name: string, options: ContextOptions) {
        super();
        this.name = name;
        this.shell = options.shell;
        this.data = options.data;
        this.parent = options.parent;

        const computeCurrent: (a: Context, b: string[]) => string[] =
            (ctx, acc) => {
                if (ctx.parent) {
                    return computeCurrent(ctx.parent, acc);
                }
                return acc.concat([ctx.data.id]);
            };

        this.current = computeCurrent(this, []);
    }

    /**
     *  this function executes a command in the scope of this context
     */
    exec(sys: ISys, tokens: string[]): Promise<any> {
        if (tokens.length > 0) {
            const cmd = tokens[0];
            const argv = tokens.slice(1);
            const commands = this.commands;
            const ctx = <Context>this;
            const finder: (a: ICommand) => boolean =
                (c) => c.name === cmd;
            const com = commands.find(finder);

            if (com) {
                return com.command(ctx, sys, argv);
            }
            else if (this.parent) {
                return this.parent.exec(sys, tokens);
            }
            return Promise.reject(
                new Error(`command not found: ${cmd}`));
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


    end<T>(ret: IContextEndResolver<T> | T) {
        if (_.isFunction(<IContextEndResolver<T>>ret)) { // we assume fn(resolve, reject)
            const resolver = <IContextEndResolver<T>>ret;
            return (new Promise<T>(resolver));
        }
        return Promise.resolve<T>(<T>ret);
    }

    endWithError<T>(err: Error) {
        return Promise.reject<T>(err);
    }

}


