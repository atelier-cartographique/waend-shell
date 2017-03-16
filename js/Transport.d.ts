/// <reference types="node" />
/// <reference types="bluebird" />
import * as Promise from 'bluebird';
import * as EventEmitter from 'events';
export interface IHeaders {
    [propName: string]: string;
}
export interface IParams {
    [propName: string]: string;
}
export interface IResolve {
    (a: any): void;
}
export interface IReject {
    (err: Error): void;
}
export interface ITransportResolver {
    (resolve: IResolve, reject: IReject): void;
}
export interface IListeners {
    [propName: string]: EventListener | null;
}
export declare type Verb = 'GET' | 'POST' | 'PUT' | 'DELETE';
export interface BaseOptions<T> {
    url: string;
    parse: (a: any) => T;
    params?: any;
    headers?: any;
}
export interface GetOptions<T> extends BaseOptions<T> {
}
export interface PostOptions<T> extends BaseOptions<T> {
    body: any;
    progress?: (a: boolean, b: number, c: number) => void;
}
export interface PutOptions<T> extends PostOptions<T> {
}
export interface DelOptions<T> extends BaseOptions<T> {
}
export interface ITransportOptions {
    verb: Verb;
    url: string;
    params: IParams;
    body: any;
    headers: IHeaders;
    listeners: IListeners;
    beforeSend?: (a: XMLHttpRequest) => void;
}
export declare class Transport extends EventEmitter {
    protected transport: (o: ITransportOptions) => void;
    constructor();
    get<T>(getOptions: GetOptions<T>): Promise<T>;
    _write<T>(verb: Verb, url: string, postOptions: PostOptions<T> | PutOptions<T>): Promise<T>;
    post<T>(options: PostOptions<T>): Promise<T>;
    put<T>(options: PutOptions<T>): Promise<T>;
    del<T>(delOptions: DelOptions<T>): Promise<T>;
}
