/*
 * app/lib/Transport.js
 *
 *
 * Copyright (C) 2015  Pierre Marchand <pierremarc07@gmail.com>
 *
 * License in LICENSE file at the root of the repository.
 *
 */


import * as _ from 'lodash';
import * as Promise from 'bluebird';
import * as querystring from 'querystring';
import * as EventEmitter from 'events';
import * as debug from 'debug';
const logger = debug('waend:Transport');


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
    [propName: string]: EventListener;
}

export type Verb = 'GET' | 'POST' | 'PUT' | 'DELETE';


export interface BaseOptions<T> {
    url: string;
    parse: (a: any) => T;
    params?: any;
    headers?: any;
}

export interface GetOptions<T> extends BaseOptions<T> { }

export interface PostOptions<T> extends BaseOptions<T> {
    body: any;
    progress?: (a: boolean, b: number, c: number) => void;
}

export interface PutOptions<T> extends PostOptions<T> { }

export interface DelOptions<T> extends BaseOptions<T> { }

export interface ITransportOptions {
    verb: Verb;
    url: string;
    params: IParams;
    body: any;
    headers: IHeaders;
    listeners: IListeners,
    beforeSend?: (a: XMLHttpRequest) => void;
}




function transportXHR() {

    const mkListener: (a: XMLHttpRequest | XMLHttpRequestUpload, b: string, c: EventListener) => void =
        (emitter, eventName, cb) => {
            emitter.addEventListener(eventName, evt => {
                logger('XHR event', eventName);
                cb(evt);
            }, false);
        };


    const mkListeners: (a: XMLHttpRequest, b: IListeners) => void =
        (emitter, listeners) => {
            Object.keys(listeners).filter(k => !_.startsWith(k, 'upload:'))
                .forEach((k) => {
                    const li = listeners[k];
                    logger('XHR set event handler', k);
                    mkListener(emitter, k, li);
                });

            if (emitter.upload) {
                const uploadEmitter = emitter.upload;
                Object.keys(listeners)
                    .filter(k => _.startsWith(k, 'upload:'))
                    .map(k => k.split(':')[1])
                    .forEach((k) => {
                        const li = listeners[k];
                        logger('XHR.upload set event handler', k);
                        mkListener(uploadEmitter, k, li);
                    });
            }
        };


    const transport =
        (options: ITransportOptions) => {
            const xhr = new XMLHttpRequest();

            mkListeners(xhr, options.listeners);

            let url = options.url;
            if ('params' in options) {
                url += `?${querystring.stringify(options.params)}`;
            }
            xhr.open(options.verb, url, true);

            Object.keys(_.omit(options.headers || {}, 'Connection', 'Content-Length'))
                .forEach((hk) => {
                    try {
                        xhr.setRequestHeader(hk, options.headers[hk]);
                    }
                    catch (err) {
                        logger('transportXHR setHeader', err);
                    }

                });

            if (options.beforeSend) {
                options.beforeSend(xhr);
            }

            xhr.responseType = "json";
            xhr.send(options.body);
            return xhr;
        };

    return transport;
}

interface IBaseHandlers {
    errorhandler(e: Event): void;
    successHandler(e: Event): void;
}


const getBaseHandlers =
    function <T>(resolve: IResolve, reject: IReject, options: BaseOptions<T>): IBaseHandlers {
        const errorhandler = (e: Event) => {
            const xhr = <XMLHttpRequest>e.target;
            reject(new Error(xhr.statusText));
        };
        const successHandler = (e: Event) => {
            const xhr = <XMLHttpRequest>e.target;
            if (xhr.status >= 400) {
                return reject(new Error(xhr.statusText));
            }
            if (options.parse) {
                resolve(options.parse(xhr.response));
            }
            else {
                resolve(xhr.response);
            }
        };
        return { errorhandler, successHandler };
    };

class Transport extends EventEmitter {

    protected transport: (o: ITransportOptions) => void;

    constructor() {
        super();
        // TODO: support different transports
        this.transport = transportXHR();
    }

    get<T>(getOptions: GetOptions<T>) {
        const { url } = getOptions;
        const transport = this.transport;
        getOptions = getOptions || {};

        const resolver: ITransportResolver =
            (resolve, reject) => {
                const { errorhandler, successHandler } =
                    getBaseHandlers<T>(resolve, reject, getOptions);

                const options: ITransportOptions = {
                    listeners: {
                        error: errorhandler,
                        abort: errorhandler,
                        timeout: errorhandler,
                        load: successHandler,
                    },
                    headers: _.extend({}, getOptions.headers),
                    params: getOptions.params,
                    verb: 'GET',
                    url: url,
                    body: null
                };

                transport(options);
            };

        return new Promise<T>(resolver);
    }

    _write<T>(verb: Verb, url: string, postOptions: PostOptions<T> | PutOptions<T>) {
        const transport = this.transport;
        postOptions = postOptions || {};

        const resolver: ITransportResolver =
            (resolve, reject) => {
                const { errorhandler, successHandler } =
                    getBaseHandlers<T>(resolve, reject, postOptions);

                const progressHandler: (a: ProgressEvent) => void =
                    (evt) => {
                        if (postOptions.progress) {
                            postOptions.progress(
                                evt.lengthComputable,
                                evt.loaded,
                                evt.total
                            );
                        }
                    };

                let body;
                if (postOptions.headers
                    && ('Content-Type' in postOptions.headers)) {
                    body = postOptions.body;
                }
                else {
                    body = ('toJSON' in postOptions.body) ? postOptions.body.toJSON() : JSON.stringify(postOptions.body);
                }
                //logger(body);
                const headers = _.defaults(_.extend({}, postOptions.headers), {
                    'Content-Type': 'application/json; charset="utf-8"',
                    'Content-Length': body.length
                });


                const options: ITransportOptions = {
                    listeners: {
                        error: errorhandler,
                        abort: errorhandler,
                        timeout: errorhandler,
                        load: successHandler,
                        'upload:progress': progressHandler
                    },
                    headers: headers,
                    params: postOptions.params,
                    verb: verb,
                    body: body,
                    url: url
                };

                transport(options);
            };

        return new Promise<T>(resolver);
    }

    post<T>(options: PostOptions<T>) {
        return this._write<T>('POST', options.url, options);
    }

    put<T>(options: PutOptions<T>) {
        return this._write<T>('PUT', options.url, options);
    }

    del<T>(delOptions: DelOptions<T>) {
        const transport = this.transport;
        delOptions = delOptions || {};

        const resolver: ITransportResolver =
            (resolve, reject) => {
                const { errorhandler, successHandler } =
                    getBaseHandlers<T>(resolve, reject, delOptions);

                const options: ITransportOptions = {
                    listeners: {
                        error: errorhandler,
                        abort: errorhandler,
                        timeout: errorhandler,
                        load: successHandler,
                    },
                    headers: _.extend({}, delOptions.headers),
                    params: delOptions.params,
                    verb: 'DELETE',
                    url: delOptions.url,
                    body: null
                };

                transport(options);
            };

        return new Promise<T>(resolver);
    }
}



export default Transport;
