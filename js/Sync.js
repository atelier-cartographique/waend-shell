"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const SockJS = require("sockjs-client");
const debug = require("debug");
const Semaphore_1 = require("./Semaphore");
const logger = debug('waend:Sync');
let sock;
const pendings = [];
function sockOpen() {
    logger('sync opened', pendings.length);
    for (let i = 0; i < pendings.length; i++) {
        const msg = JSON.stringify(pendings[i]);
        sock.send(msg);
    }
}
function assert(a) {
    if (!a) {
        throw (new Error());
    }
}
function makeMessage(json) {
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
function sockMessage(evt) {
    const message = makeMessage(evt.data);
    if (message) {
        Semaphore_1.default.signal('sync', message);
    }
}
function sockClose(exp) {
    logger('sync closed', exp);
}
function configure(url) {
    sock = (new SockJS(url));
    sock.onopen = sockOpen;
    sock.onclose = sockClose;
    sock.onmessage = sockMessage;
}
exports.configure = configure;
function send(...args) {
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
exports.send = send;
function subscribe(type, id) {
    exports.send('sub', type, id);
}
exports.subscribe = subscribe;
//# sourceMappingURL=Sync.js.map