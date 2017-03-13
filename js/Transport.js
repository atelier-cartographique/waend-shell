"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require("lodash");
const Promise = require("bluebird");
const querystring = require("querystring");
const EventEmitter = require("events");
const debug = require("debug");
const logger = debug('waend:Transport');
function transportXHR() {
    const mkListener = (emitter, eventName, cb) => {
        emitter.addEventListener(eventName, evt => {
            logger('XHR event', eventName);
            cb(evt);
        }, false);
    };
    const mkListeners = (emitter, listeners) => {
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
    const transport = (options) => {
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
const getBaseHandlers = function (resolve, reject, options) {
    const errorhandler = (e) => {
        const xhr = e.target;
        reject(new Error(xhr.statusText));
    };
    const successHandler = (e) => {
        const xhr = e.target;
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
    constructor() {
        super();
        this.transport = transportXHR();
    }
    get(getOptions) {
        const { url } = getOptions;
        const transport = this.transport;
        getOptions = getOptions || {};
        const resolver = (resolve, reject) => {
            const { errorhandler, successHandler } = getBaseHandlers(resolve, reject, getOptions);
            const options = {
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
        return new Promise(resolver);
    }
    _write(verb, url, postOptions) {
        const transport = this.transport;
        postOptions = postOptions || {};
        const resolver = (resolve, reject) => {
            const { errorhandler, successHandler } = getBaseHandlers(resolve, reject, postOptions);
            const progressHandler = (evt) => {
                if (postOptions.progress) {
                    postOptions.progress(evt.lengthComputable, evt.loaded, evt.total);
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
            const headers = _.defaults(_.extend({}, postOptions.headers), {
                'Content-Type': 'application/json; charset="utf-8"',
                'Content-Length': body.length
            });
            const options = {
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
        return new Promise(resolver);
    }
    post(options) {
        return this._write('POST', options.url, options);
    }
    put(options) {
        return this._write('PUT', options.url, options);
    }
    del(delOptions) {
        const transport = this.transport;
        delOptions = delOptions || {};
        const resolver = (resolve, reject) => {
            const { errorhandler, successHandler } = getBaseHandlers(resolve, reject, delOptions);
            const options = {
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
        return new Promise(resolver);
    }
}
exports.default = Transport;
//# sourceMappingURL=Transport.js.map