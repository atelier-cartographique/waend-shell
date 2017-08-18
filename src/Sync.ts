/*
 * src/Sync.ts
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


import * as SockJS from 'sockjs-client';
import * as debug from 'debug';
import { semaphore } from './Semaphore';
import { ModelData } from "waend-lib";
const logger = debug('waend:Sync');

export interface IChannel {
    type: string;
    id: string;
}


export type ISyncEvent = 'update' | 'create' | 'delete';

export interface ISyncMessage {
    channel: IChannel;
    event: ISyncEvent;
    data: ModelData | string;
}




let sock: SockJS.Socket;
const pendings: any[] = [];

function sockOpen() {
    logger('sync opened', pendings.length);

    for (let i = 0; i < pendings.length; i++) {
        const msg = JSON.stringify(pendings[i]);
        sock.send(msg);
    }
}

function assert(a: boolean) {
    if (!a) {
        throw (new Error());
    }
}

function makeMessage(json: string): (null | ISyncMessage) {
    try {
        const msg = JSON.parse(json);
        assert(msg.length === 3);

        const channel = msg[0];
        const event = msg[1];
        const data = msg[2];

        assert('type' in channel);
        assert('id' in channel);
        assert((typeof channel.type) === 'string');
        assert((typeof channel.id) === 'string');
        assert((typeof event) === 'string');

        return { channel, event, data };
    }
    catch (err) {
        return null;
    }
}

function sockMessage(evt: MessageEvent) {
    const message = makeMessage(evt.data);
    if (message) {
        semaphore.signal<ISyncMessage>('sync', message);
    }
}

function sockClose(exp: CloseEvent) {
    logger('sync closed', exp);
}



export function configure(url: string) {
    sock = new SockJS(url);
    sock.onopen = sockOpen;
    sock.onclose = sockClose;
    sock.onmessage = sockMessage;
}

/**
 * send raw data to the nofify end point
 * @method send
 * @return {bool} true if data has been sent, false if delayed or failed
 */
export function send(...args: any[]) {
    if (!sock || (sock.readyState !== SockJS.OPEN)) {
        pendings.push(args);
    }
    else {
        try {
            sock.send(JSON.stringify(args));
            return true;
        }
        catch (err) {
            console.error('Sync.send', err);
        }
    }
    return false;
}

/**
 * subscribe to a channel
 * @method subscribe
 * @param  {string}  type A channel name, which is usually a context name
 * @param  {string}  id   context id
 */

export function subscribe(type: string, id: string) {
    send('sub', type, id);
}
