/*
 * src/Context.ts
 *
 * 
 * Copyright (C) 2015-2017 Pierre Marchand <pierremarc07@gmail.com>
 * Copyright (C) 2017 Pacôme Béru <pacome.beru@gmail.com>
 *
 *  License in LICENSE file at the root of the repository.
 *
 *  This file is part of waend-shell package.
 *
 *  waend-shell is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, version 3 of the License.
 *
 *  waend-shell is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with waend-shell.  If not, see <http://www.gnu.org/licenses/>.
 */


import * as EventEmitter from 'events';
import { resolve } from 'path';
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
    commands: ICommand[];
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


const findCommand: (a: ICommand[], b: string) => (ICommand | null) =
    (cs, cmdName) => {
        for (let i = 0; i < cs.length; i += 1) {
            if (cs[i].name === cmdName) {
                return cs[i];
            }
        }
        return null;
    };

export class Context extends EventEmitter {

    public binder: Bind;
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
        this.commands = options.commands;
        this.parent = options.parent;
        this.binder = getBinder();

        const computeCurrent: (a: Context, b: string[]) => string[] =
            (ctx, acc) => {
                if (ctx.parent) {
                    return computeCurrent(ctx.parent, [ctx.data.id].concat(acc));
                }
                return acc;
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
            const com = findCommand(commands, cmd);

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

    resolve(...pathSegments: string[]) {
        const contextPath = resolve('/', ...this.current);
        return resolve(contextPath, ...pathSegments);
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


