"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var SockJS = require("sockjs-client");
var debug = require("debug");
var Semaphore_1 = require("./Semaphore");
var logger = debug('waend:Sync');
var sock;
var pendings = [];
function sockOpen() {
    logger('sync opened', pendings.length);
    for (var i = 0; i < pendings.length; i++) {
        var msg = JSON.stringify(pendings[i]);
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
        var msg = JSON.parse(json);
        assert(msg.length === 3);
        var channel = msg[0];
        var event_1 = msg[1];
        var data = msg[2];
        assert('type' in channel);
        assert('id' in channel);
        assert((typeof channel.type) === 'string');
        assert((typeof channel.id) === 'string');
        assert((typeof event_1) === 'string');
        return { channel: channel, event: event_1, data: data };
    }
    catch (err) {
        return null;
    }
}
function sockMessage(evt) {
    var message = makeMessage(evt.data);
    if (message) {
        Semaphore_1.semaphore.signal('sync', message);
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
function send() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
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
    send('sub', type, id);
}
exports.subscribe = subscribe;
