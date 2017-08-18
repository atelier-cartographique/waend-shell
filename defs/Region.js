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
var lodash_1 = require("lodash");
var EventEmitter = require("events");
var Semaphore_1 = require("./Semaphore");
var waend_lib_1 = require("waend-lib");
var waend_util_1 = require("waend-util");
function fequals(a, b, p) {
    return (Math.abs(a - b) < p);
}
function compProjected(pt, INC) {
    try {
        var r = waend_util_1.pointProject(pt);
        var ir = waend_util_1.pointUnproject(r);
        return fequals(ir[1], pt[1], INC);
    }
    catch (err) {
        return false;
    }
}
function maxVert() {
    var pt = [0, 0];
    var INC = 0.1;
    var ret = 90;
    for (var i = 80; i < 90; i += INC) {
        pt = [180, i];
        if (!compProjected(pt, INC)) {
            ret = i - INC;
            break;
        }
    }
    return ret;
}
var horizMax = 180;
var vertiMax = maxVert();
var WORLD_EXTENT = new waend_lib_1.Extent([-horizMax, -vertiMax, horizMax, vertiMax]);
var Region = (function (_super) {
    __extends(Region, _super);
    function Region() {
        var _this = _super.call(this) || this;
        _this.state = [WORLD_EXTENT.clone()];
        Semaphore_1.semaphore.on('region:push', _this.push.bind(_this));
        return _this;
    }
    Region.getWorldExtent = function () {
        return WORLD_EXTENT.clone();
    };
    Region.prototype.get = function () {
        return lodash_1.last(this.state).clone();
    };
    Region.prototype.pop = function () {
        var extent = this.state.pop();
        if (extent) {
            this.emitChange(extent);
            return extent;
        }
        return null;
    };
    Region.prototype.emitChange = function (extent) {
        Semaphore_1.semaphore.signal('region:change', extent);
    };
    Region.prototype.pushExtent = function (extent) {
        this.state.push(extent.normalize());
        this.emitChange(extent);
    };
    Region.prototype.push = function (e) {
        var extent;
        if (e instanceof waend_lib_1.Extent) {
            extent = e.clone();
        }
        else if (e instanceof waend_lib_1.Geometry) {
            extent = e.getExtent();
        }
        else if (Array.isArray(e)) {
            extent = new waend_lib_1.Extent(e);
        }
        else {
            return false;
        }
        this.pushExtent(extent);
        return true;
    };
    return Region;
}(EventEmitter));
exports.Region = Region;
;
exports.region = new Region();
