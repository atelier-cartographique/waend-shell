import * as EventEmitter from 'events';


export type Observer<T> = (a: T) => void;
export type Observer2<T, U> = (a: T, b: U) => void;

export class Semaphore extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(256);
    }

    signal<T>(event: string, arg?: T) {
        this.emit(event, arg);
    }

    signal2<T, U>(event: string, arg0: T, arg1: U) {
        this.emit(event, arg0, arg1);
    }

    signal3<T, U, V>(event: string, arg0: T, arg1: U, arg2: V) {
        this.emit(event, arg0, arg1, arg2);
    }

    observe<T>(event: string, fn: Observer<T>) {
        this.on(event, fn);
    }

    observe2<T, U>(event: string, fn: Observer2<T, U>) {
        this.on(event, fn);
    }

}

const semaphore = new Semaphore();
export default semaphore;
