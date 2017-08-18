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
var _ = require("lodash");
var Promise = require("bluebird");
var querystring = require("querystring");
var EventEmitter = require("events");
var debug = require("debug");
var logger = debug('waend:Transport');
function transportXHR() {
    var mkListener = function (emitter, eventName, cb) {
        emitter.addEventListener(eventName, function (evt) {
            logger('XHR event', eventName);
            cb(evt);
        }, false);
    };
    var mkListeners = function (emitter, listeners) {
        Object.keys(listeners).filter(function (k) { return !_.startsWith(k, 'upload:'); })
            .forEach(function (k) {
            var li = listeners[k];
            if (li) {
                logger('XHR set event handler', k);
                mkListener(emitter, k, li);
            }
        });
        if (emitter.upload) {
            var uploadEmitter_1 = emitter.upload;
            Object.keys(listeners)
                .filter(function (k) { return _.startsWith(k, 'upload:'); })
                .map(function (k) { return k.split(':')[1]; })
                .forEach(function (k) {
                var li = listeners["upload:" + k];
                if (li) {
                    logger('XHR.upload set event handler', k);
                    mkListener(uploadEmitter_1, k, li);
                }
            });
        }
    };
    var transport = function (options) {
        var xhr = new XMLHttpRequest();
        mkListeners(xhr, options.listeners);
        var url = options.url;
        if ('params' in options) {
            url += "?" + querystring.stringify(options.params);
        }
        xhr.open(options.verb, url, true);
        Object.keys(_.omit(options.headers || {}, 'Connection', 'Content-Length'))
            .forEach(function (hk) {
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
var getBaseHandlers = function (resolve, reject, options) {
    var errorhandler = function (e) {
        var xhr = e.target;
        reject(new Error(xhr.statusText));
    };
    var successHandler = function (e) {
        var xhr = e.target;
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
    return { errorhandler: errorhandler, successHandler: successHandler };
};
var Transport = (function (_super) {
    __extends(Transport, _super);
    function Transport() {
        var _this = _super.call(this) || this;
        _this.transport = transportXHR();
        return _this;
    }
    Transport.prototype.get = function (getOptions) {
        var url = getOptions.url;
        var transport = this.transport;
        getOptions = getOptions || {};
        var resolver = function (resolve, reject) {
            var _a = getBaseHandlers(resolve, reject, getOptions), errorhandler = _a.errorhandler, successHandler = _a.successHandler;
            var options = {
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
    };
    Transport.prototype._write = function (verb, url, postOptions) {
        var transport = this.transport;
        postOptions = postOptions || {};
        var resolver = function (resolve, reject) {
            var _a = getBaseHandlers(resolve, reject, postOptions), errorhandler = _a.errorhandler, successHandler = _a.successHandler;
            var progressHandler = function (evt) {
                if (postOptions.progress) {
                    postOptions.progress(evt.lengthComputable, evt.loaded, evt.total);
                }
            };
            var body;
            if (postOptions.headers
                && ('Content-Type' in postOptions.headers)) {
                body = postOptions.body;
            }
            else {
                body = ('toJSON' in postOptions.body) ? postOptions.body.toJSON() : JSON.stringify(postOptions.body);
            }
            var headers = _.defaults(_.extend({}, postOptions.headers), {
                'Content-Type': 'application/json; charset="utf-8"',
                'Content-Length': body.length
            });
            var options = {
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
    };
    Transport.prototype.post = function (options) {
        return this._write('POST', options.url, options);
    };
    Transport.prototype.put = function (options) {
        return this._write('PUT', options.url, options);
    };
    Transport.prototype.del = function (delOptions) {
        var transport = this.transport;
        delOptions = delOptions || {};
        var resolver = function (resolve, reject) {
            var _a = getBaseHandlers(resolve, reject, delOptions), errorhandler = _a.errorhandler, successHandler = _a.successHandler;
            var options = {
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
    };
    return Transport;
}(EventEmitter));
exports.Transport = Transport;
