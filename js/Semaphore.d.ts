/// <reference types="node" />
import * as EventEmitter from 'events';
export declare type Observer<T> = (a: T) => void;
export declare type Observer2<T, U> = (a: T, b: U) => void;
export declare class Semaphore extends EventEmitter {
    constructor();
    signal<T>(event: string, arg?: T): void;
    signal2<T, U>(event: string, arg0: T, arg1: U): void;
    signal3<T, U, V>(event: string, arg0: T, arg1: U, arg2: V): void;
    observe<T>(event: string, fn: Observer<T>): void;
    observe2<T, U>(event: string, fn: Observer2<T, U>): void;
}
export declare const semaphore: Semaphore;
