/// <reference types="node" />
import * as EventEmitter from 'events';
import { Extent, Geometry } from 'waend-lib';
export declare class Region extends EventEmitter {
    private state;
    constructor();
    static getWorldExtent(): Extent;
    get(): Extent;
    pop(): Extent | null;
    emitChange(extent: Extent): void;
    pushExtent(extent: Extent): void;
    push(e: Extent | Array<number> | Geometry): boolean;
}
export declare const region: Region;
