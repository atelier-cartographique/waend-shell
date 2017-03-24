/*
 * src/Env.ts
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

type Getter<T> = () => T;


interface EnvStore {
    [key: string]: any;
}

const store: EnvStore = {};

export const setenv =
    function <T>(key: string, value: T): Getter<T> {
        const getter = () => value;
        store[key] = getter;
        return getter;
    }


export const getenv =
    function <T>(key: string, def?: T): (null | T) {
        if (key in store) {
            return store[key]();
        }
        if (def) {
            return def;
        }
        return null;
    }

export default { setenv, getenv };