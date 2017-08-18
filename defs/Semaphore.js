"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var EventEmitter = require("events");
var Semaphore = (function (_super) {
    __extends(Semaphore, _super);
    function Semaphore() {
        var _this = _super.call(this) || this;
        _this.setMaxListeners(256);
        return _this;
    }
    Semaphore.prototype.signal = function (event, arg) {
        this.emit(event, arg);
    };
    Semaphore.prototype.signal2 = function (event, arg0, arg1) {
        this.emit(event, arg0, arg1);
    };
    Semaphore.prototype.signal3 = function (event, arg0, arg1, arg2) {
        this.emit(event, arg0, arg1, arg2);
    };
    Semaphore.prototype.observe = function (event, fn) {
        this.on(event, fn);
    };
    Semaphore.prototype.observe2 = function (event, fn) {
        this.on(event, fn);
    };
    return Semaphore;
}(EventEmitter));
exports.Semaphore = Semaphore;
exports.semaphore = new Semaphore();
