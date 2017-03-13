/*
 * app/lib/Sync.js
 *
 *
 * Copyright (C) 2015  Pierre Marchand <pierremarc07@gmail.com>
 *
 * License in LICENSE file at the root of the repository.
 *
 */


import * as SockJS from 'sockjs-client';
import * as debug from 'debug';
import semaphore from './Semaphore';
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




let sock: WebSocket;
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
    sock = <WebSocket>(new SockJS(url));
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
    exports.send('sub', type, id);
}
