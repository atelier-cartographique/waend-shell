"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const EventEmitter = require("events");
class Semaphore extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(256);
    }
    signal(event, arg) {
        this.emit(event, arg);
    }
    signal2(event, arg0, arg1) {
        this.emit(event, arg0, arg1);
    }
    signal3(event, arg0, arg1, arg2) {
        this.emit(event, arg0, arg1, arg2);
    }
    observe(event, fn) {
        this.on(event, fn);
    }
    observe2(event, fn) {
        this.on(event, fn);
    }
}
exports.Semaphore = Semaphore;
exports.semaphore = new Semaphore();
//# sourceMappingURL=Semaphore.js.map