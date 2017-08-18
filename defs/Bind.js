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
var EventEmitter = require("events");
var debug = require("debug");
var Transport_1 = require("./Transport");
var Sync_1 = require("./Sync");
var Semaphore_1 = require("./Semaphore");
var waend_lib_1 = require("waend-lib");
var logger = debug('waend:Bind');
var db_store = {};
var DB = (function (_super) {
    __extends(DB, _super);
    function DB(t, apiUrl) {
        var _this = _super.call(this) || this;
        _this.apiUrl = apiUrl;
        _this.transport = t;
        return _this;
    }
    Object.defineProperty(DB.prototype, "_db", {
        get: function () { return db_store; },
        enumerable: true,
        configurable: true
    });
    DB.prototype.makePath = function (comps) {
        var cl = comps.length;
        if (1 === cl) {
            return "/user/" + comps[0];
        }
        else if (2 === cl) {
            return "/user/" + comps[0] + "/group/" + comps[1];
        }
        else if (3 === cl) {
            return "/user/" + comps[0] + "/group/" + comps[1] + "/layer/" + comps[2];
        }
        else if (4 === cl) {
            return "/user/" + comps[0] + "/group/" + comps[1] + "/layer/" + comps[2] + "/feature/" + comps[3];
        }
        throw (new Error('wrong number of comps'));
    };
    DB.prototype.getParent = function (comps) {
        if (comps.length > 1) {
            return comps[comps.length - 2];
        }
        return null;
    };
    DB.prototype.record = function (comps, model) {
        var id = model.id;
        var parent = this.getParent(comps);
        var rec;
        if (id in this._db) {
            var oldRec = this._db[id];
            oldRec.model._updateData(model.cloneData(), false);
            rec = {
                model: oldRec.model,
                comps: oldRec.comps,
                parent: parent,
            };
        }
        else {
            rec = {
                model: model,
                comps: comps,
                parent: parent,
            };
        }
        this._db[id] = rec;
        return rec;
    };
    DB.prototype.update = function (model) {
        var _this = this;
        var self = this;
        var db = this._db;
        var record = db[model.id];
        var path = this.makePath(record.comps);
        var resolver = function (resolve, reject) {
            var options = {
                url: _this.apiUrl + path,
                body: model,
                parse: function () { return model; },
            };
            self.transport
                .put(options)
                .then(function () {
                db[model.id] = {
                    model: model,
                    comps: record.comps,
                    parent: record.parent,
                };
                resolve(model);
            })
                .catch(reject);
        };
        return (new Promise(resolver));
    };
    DB.prototype.has = function (id) {
        return (id in this._db);
    };
    DB.prototype.get = function (id) {
        return (this._db[id].model);
    };
    DB.prototype.del = function (id) {
        delete this._db[id];
    };
    DB.prototype.getComps = function (id) {
        return _.clone(this._db[id].comps);
    };
    DB.prototype.lookupKey = function (prefix) {
        var _this = this;
        var pat = new RegExp("^" + prefix + ".*");
        var keys = Object.keys(this._db);
        return keys.reduce(function (acc, key) {
            if (key.match(pat)) {
                return acc.concat([_this.get(key)]);
            }
            return acc;
        }, []);
    };
    DB.prototype.lookup = function (predicate) {
        var filtered = _.filter(this._db, predicate);
        var result = _.map(filtered, function (rec) { return rec['model']; });
        return result;
    };
    return DB;
}(EventEmitter));
exports.DB = DB;
function objectifyResponse(response) {
    if ('string' === typeof response) {
        try {
            return JSON.parse(response);
        }
        catch (err) {
            console.error(err);
            throw (err);
        }
    }
    return response;
}
var Bind = (function (_super) {
    __extends(Bind, _super);
    function Bind(apiUrl) {
        var _this = _super.call(this) || this;
        _this.apiUrl = apiUrl;
        _this.transport = new Transport_1.Transport();
        _this.db = new DB(_this.transport, apiUrl);
        _this.featurePages = {};
        _this.groupCache = {};
        Semaphore_1.semaphore.observe('sync', function (message) {
            var channel = message.channel, event = message.event, data = message.data;
            if ('update' === event) {
                var modelData = data;
                if (_this.db.has(modelData.id)) {
                    var model = _this.db.get(modelData.id);
                    model._updateData(modelData, false);
                }
            }
            else if ('create' === event) {
                var modelData = data;
                var ctx = channel.type;
                if ('layer' === ctx) {
                    if (!_this.db.has(modelData.id)) {
                        var layerId = channel.id;
                        var feature = new waend_lib_1.Feature(modelData);
                        var comps = _this.getComps(layerId);
                        comps.push(feature.id);
                        _this.db.record(comps, feature);
                        _this.changeParent(layerId);
                    }
                }
            }
            else if ('delete' === event) {
                var ctx = channel.type;
                if ('layer' === ctx) {
                    var fid = data;
                    if (_this.db.has(fid)) {
                        var layerId = channel.id;
                        _this.db.del(fid);
                        _this.changeParent(layerId);
                    }
                }
            }
        });
        return _this;
    }
    Bind.prototype.update = function (model, key, val) {
        var keys = key.split('.');
        var props = model.getData();
        if (1 === keys.length) {
            props[key] = val;
        }
        else {
            var kl = keys.length;
            var currentDict = props;
            var k = void 0;
            for (var i = 0; i < kl; i++) {
                k = keys[i];
                if ((i + 1) === kl) {
                    currentDict[k] = val;
                }
                else {
                    if (!(k in currentDict)) {
                        currentDict[k] = {};
                    }
                    else {
                        currentDict[k] = {};
                    }
                    currentDict = currentDict[k];
                }
            }
        }
        model.emit('set', key, val);
        return this.db.update(model);
    };
    Bind.prototype.updateGeometry = function (model, geom) {
        if (geom instanceof waend_lib_1.Geometry) {
            model.setGeometry(geom.toGeoJSON());
        }
        else {
            model.setGeometry(geom);
        }
        model.emit('set', 'geom', geom);
        return this.db.update(model);
    };
    Bind.prototype.changeParent = function (parentId) {
        if (this.db.has(parentId)) {
            var parent_1 = this.db.get(parentId);
            logger('binder.changeParent', parent_1.id);
            parent_1.emit('change');
        }
    };
    Bind.prototype.getMe = function () {
        var db = this.db;
        var parse = function (response) {
            var u = new waend_lib_1.User(objectifyResponse(response));
            db.record([u.id], u);
            return u;
        };
        var url = this.apiUrl + "/auth";
        return this.transport.get({ url: url, parse: parse });
    };
    Bind.prototype.getComps = function (id) {
        return this.db.getComps(id);
    };
    Bind.prototype.getUser = function (userId) {
        var db = this.db;
        var path = "/user/" + userId;
        if (db.has(userId)) {
            return Promise.resolve(db.get(userId));
        }
        var parse = function (response) {
            var u = new waend_lib_1.User(objectifyResponse(response));
            db.record([userId], u);
            return u;
        };
        var url = this.apiUrl + path;
        return this.transport.get({ url: url, parse: parse });
    };
    Bind.prototype.getGroup = function (userId, groupId) {
        var db = this.db;
        var path = "/user/" + userId + "/group/" + groupId;
        if (db.has(groupId)) {
            return Promise.resolve(db.get(groupId));
        }
        var parse = function (response) {
            var groupData = objectifyResponse(response);
            var modelData = {
                id: groupData.group.id,
                properties: groupData.group.properties
            };
            var g = new waend_lib_1.Group(modelData);
            var layers = groupData.group.layers;
            db.record([userId, groupId], g);
            for (var _i = 0, layers_1 = layers; _i < layers_1.length; _i++) {
                var layer = layers_1[_i];
                var layerData = {
                    id: layer.id,
                    properties: layer.properties,
                };
                var l = new waend_lib_1.Layer(layerData);
                db.record([userId, groupId, layer.id], l);
                for (var _a = 0, _b = layer.features; _a < _b.length; _a++) {
                    var feature = _b[_a];
                    var f = new waend_lib_1.Feature(feature);
                    db.record([userId, groupId, layer.id, feature.id], f);
                }
                Sync_1.subscribe('layer', layer.id);
            }
            Semaphore_1.semaphore.signal('stop:loader');
            Sync_1.subscribe('group', groupId);
            return g;
        };
        var url = this.apiUrl + path;
        Semaphore_1.semaphore.signal('start:loader', 'downloading map data');
        return this.transport.get({ url: url, parse: parse });
    };
    Bind.prototype.getGroups = function (userId) {
        var db = this.db;
        var path = "/user/" + userId + "/group/";
        var gc = this.groupCache;
        var parse = function (response) {
            var data = objectifyResponse(response);
            var ret = [];
            for (var _i = 0, _a = data.results; _i < _a.length; _i++) {
                var groupData = _a[_i];
                if (db.has(groupData.id)) {
                    ret.push(db.get(groupData.id));
                }
                else if (groupData.id in gc) {
                    ret.push(gc[groupData.id]);
                }
                else {
                    var g = new waend_lib_1.Group(groupData);
                    gc[groupData.id] = g;
                    ret.push(g);
                }
            }
            return ret;
        };
        var url = this.apiUrl + path;
        return this.transport.get({ url: url, parse: parse });
    };
    Bind.prototype.getLayer = function (userId, groupId, layerId) {
        var db = this.db;
        var path = "/user/" + userId + "/group/" + groupId + "/layer/" + layerId;
        if (db.has(layerId)) {
            return Promise.resolve(db.get(layerId));
        }
        var parse = function (response) {
            var l = new waend_lib_1.Layer(objectifyResponse(response));
            db.record([userId, groupId, layerId], l);
            return l;
        };
        var url = this.apiUrl + path;
        return this.transport.get({ url: url, parse: parse });
    };
    Bind.prototype.getLayers = function (_userId, groupId) {
        return Promise.resolve(this.db.lookup(function (rec) { return rec.parent === groupId; }));
    };
    Bind.prototype.getFeature = function (userId, groupId, layerId, featureId) {
        var db = this.db;
        var path = "/user/" + userId + "/group/" + groupId + "/layer/" + layerId + "/feature/" + featureId;
        if (db.has(featureId)) {
            return Promise.resolve(db.get(featureId));
        }
        var parse = function (response) {
            var f = new waend_lib_1.Feature(objectifyResponse(response));
            db.record([userId, groupId, layerId, featureId], f);
            return f;
        };
        var url = this.apiUrl + path;
        return this.transport.get({ url: url, parse: parse });
    };
    Bind.prototype.delFeature = function (userId, groupId, layerId, featureId) {
        var feature = (this.db.get(featureId));
        var geom = feature.getGeometry();
        var path = "/user/" + userId + "/group/" + groupId + "/layer/" + layerId + "/feature." + geom.getType() + "/" + featureId;
        var url = this.apiUrl + path;
        var db = this.db;
        var self = this;
        var parse = function () {
            db.del(featureId);
            self.changeParent(layerId);
        };
        return this.transport.del({ url: url, parse: parse });
    };
    Bind.prototype.getFeatures = function (_userId, _groupId, layerId) {
        return Promise.resolve(this.db.lookup(function (rec) { return rec.parent === layerId; }));
    };
    Bind.prototype.setGroup = function (userId, data) {
        var db = this.db;
        var binder = this;
        var path = "/user/" + userId + "/group/";
        var parse = function (response) {
            var g = new waend_lib_1.Group(objectifyResponse(response));
            db.record([userId, g.id], g);
            binder.changeParent(userId);
            return g;
        };
        var url = this.apiUrl + path;
        return this.transport.post({
            url: url,
            parse: parse,
            body: data
        });
    };
    Bind.prototype.setLayer = function (userId, groupId, data) {
        var db = this.db;
        var binder = this;
        var path = "/user/" + userId + "/group/" + groupId + "/layer/";
        var parse = function (response) {
            var g = new waend_lib_1.Layer(objectifyResponse(response));
            db.record([userId, groupId, g.id], g);
            binder.changeParent(groupId);
            return g;
        };
        var url = this.apiUrl + path;
        return this.transport.post({
            url: url,
            parse: parse,
            body: data
        });
    };
    Bind.prototype.setFeature = function (userId, groupId, layerId, data, batch) {
        var db = this.db;
        var binder = this;
        var path = "/user/" + userId + "/group/" + groupId + "/layer/" + layerId + "/feature/";
        var parse = function (response) {
            var f = new waend_lib_1.Feature(objectifyResponse(response));
            db.record([userId, groupId, layerId, f.id], f);
            if (!batch) {
                binder.changeParent(layerId);
            }
            return f;
        };
        var url = this.apiUrl + path;
        return this.transport.post({
            url: url,
            parse: parse,
            body: data
        });
    };
    Bind.prototype.attachLayerToGroup = function (guid, groupId, layerId) {
        var path = "/user/" + guid + "/group/" + groupId + "/attach/";
        var data = {
            'layer_id': layerId,
            'group_id': groupId
        };
        var url = this.apiUrl + path;
        return this.transport.post({
            url: url,
            body: data,
            parse: function () { return data; },
        });
    };
    Bind.prototype.detachLayerFromGroup = function (userId, groupId, layerId) {
        var _this = this;
        var path = "/user/" + userId + "/group/" + groupId + "/detach/" + layerId;
        var url = this.apiUrl + path;
        var parse = function () {
            _this.changeParent(groupId);
        };
        return this.transport.del({ url: url, parse: parse });
    };
    Bind.prototype.matchKeyAsync = function (prefix) {
        var res = this.db.lookupKey(prefix);
        if (res.length > 0) {
            return Promise.resolve(res);
        }
        return Promise.reject('No Match');
    };
    Bind.prototype.matchKey = function (prefix) {
        return this.db.lookupKey(prefix);
    };
    return Bind;
}(EventEmitter));
exports.Bind = Bind;
var bindInstance;
function getBinder(apiUrl) {
    if (!bindInstance) {
        if (apiUrl) {
            bindInstance = new Bind(apiUrl);
        }
        else {
            throw "NeedAnApiUrl";
        }
    }
    return bindInstance;
}
exports.getBinder = getBinder;
