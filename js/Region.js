"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = require("lodash");
const EventEmitter = require("events");
const Semaphore_1 = require("./Semaphore");
const waend_lib_1 = require("waend-lib");
const waend_util_1 = require("waend-util");
function fequals(a, b, p) {
    return (Math.abs(a - b) < p);
}
function compProjected(pt, INC) {
    try {
        const r = waend_util_1.Proj3857.forward(pt);
        const ir = waend_util_1.Proj3857.inverse(r);
        return fequals(ir[1], pt[1], INC);
    }
    catch (err) {
        return false;
    }
}
function maxVert() {
    let pt = [0, 0];
    const INC = 0.1;
    let ret = 90;
    for (let i = 80; i < 90; i += INC) {
        pt = [180, i];
        if (!compProjected(pt, INC)) {
            ret = i - INC;
            break;
        }
    }
    return ret;
}
const horizMax = 180;
const vertiMax = maxVert();
const WORLD_EXTENT = new waend_lib_1.Extent([-horizMax, -vertiMax, horizMax, vertiMax]);
class Region extends EventEmitter {
    constructor() {
        super();
        this.state = [WORLD_EXTENT.clone()];
        Semaphore_1.semaphore.on('region:push', this.push.bind(this));
    }
    getWorldExtent() {
        return WORLD_EXTENT.clone();
    }
    get() {
        return lodash_1.last(this.state).clone();
    }
    pop() {
        const extent = this.state.pop();
        if (extent) {
            this.emitChange(extent);
            return extent;
        }
        return null;
    }
    emitChange(extent) {
        Semaphore_1.semaphore.signal('region:change', extent);
    }
    pushExtent(extent) {
        this.state.push(extent.normalize());
        this.emitChange(extent);
    }
    push(e) {
        let extent;
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
    }
}
exports.Region = Region;
;
const region = new Region();
exports.default = region;
//# sourceMappingURL=Region.js.map