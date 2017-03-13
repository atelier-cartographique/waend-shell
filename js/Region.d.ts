/// <reference types="node" />
import * as EventEmitter from 'events';
import { Extent } from 'waend-lib';
export declare class Region extends EventEmitter {
    private state;
    constructor();
    getWorldExtent(): Extent;
    get(): Extent;
    pop(): Extent | null;
    emitChange(extent: Extent): void;
    pushExtent(extent: Extent): void;
    push(e: any): boolean;
}
declare const region: Region;
export default region;
