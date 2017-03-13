import { last } from 'lodash';
import * as EventEmitter from 'events';
import semaphore from './Semaphore';
import { Extent, Geometry } from 'waend-lib';
import { Proj3857 } from 'waend-util';



function fequals(a: number, b: number, p: number) {
    return (Math.abs(a - b) < p);
}

function compProjected(pt: number[], INC: number) {
    try {
        const r = Proj3857.forward(pt);
        const ir = Proj3857.inverse(r);
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


const WORLD_EXTENT = new Extent([-horizMax, -vertiMax, horizMax, vertiMax]);

export class Region extends EventEmitter {
    private state: Array<Extent>

    constructor() {
        super();
        this.state = [WORLD_EXTENT.clone()];
        semaphore.on('region:push', this.push.bind(this));
    }

    getWorldExtent() {
        return WORLD_EXTENT.clone();
    }

    get() {
        return last(this.state).clone();
    }

    pop() {
        const extent = this.state.pop();
        if (extent) {
            this.emitChange(extent);
            return extent;
        }
        return null;
    }

    emitChange(extent: Extent) {
        semaphore.signal('region:change', extent);
    }

    pushExtent(extent: Extent) {
        this.state.push(extent.normalize());
        this.emitChange(extent);
    }

    push(e: any): boolean {
        let extent: Extent;
        if (e instanceof Extent) {
            extent = e.clone();
        }
        else if (e instanceof Geometry) {
            extent = e.getExtent();
        }
        else if (Array.isArray(e)) { // we assume ol.extent type
            extent = new Extent(e);
        }
        else {
            return false;
        }

        this.pushExtent(extent);
        return true;
    }

};

const region: Region = new Region();

export default region;
