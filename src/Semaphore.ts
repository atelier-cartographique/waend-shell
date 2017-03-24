/*
 * src/Semaphore.ts
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


export type Observer<T> = (a: T) => void;
export type Observer2<T, U> = (a: T, b: U) => void;

export class Semaphore extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(256);
    }

    signal<T>(event: string, arg?: T) {
        this.emit(event, arg);
    }

    signal2<T, U>(event: string, arg0: T, arg1: U) {
        this.emit(event, arg0, arg1);
    }

    signal3<T, U, V>(event: string, arg0: T, arg1: U, arg2: V) {
        this.emit(event, arg0, arg1, arg2);
    }

    observe<T>(event: string, fn: Observer<T>) {
        this.on(event, fn);
    }

    observe2<T, U>(event: string, fn: Observer2<T, U>) {
        this.on(event, fn);
    }

}

export const semaphore = new Semaphore();
