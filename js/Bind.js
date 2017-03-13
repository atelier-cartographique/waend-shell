"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require("lodash");
const Promise = require("bluebird");
const EventEmitter = require("events");
const debug = require("debug");
const Transport_1 = require("./Transport");
const Sync_1 = require("./Sync");
const Semaphore_1 = require("./Semaphore");
const waend_lib_1 = require("waend-lib");
const logger = debug('waend:Bind');
const db_store = {};
class DB extends EventEmitter {
    constructor(t, apiUrl) {
        super();
        this.apiUrl = apiUrl;
        this.transport = t;
    }
    get _db() { return db_store; }
    makePath(comps) {
        const cl = comps.length;
        if (1 === cl) {
            return `/user/${comps[0]}`;
        }
        else if (2 === cl) {
            return `/user/${comps[0]}/group/${comps[1]}`;
        }
        else if (3 === cl) {
            return `/user/${comps[0]}/group/${comps[1]}/layer/${comps[2]}`;
        }
        else if (4 === cl) {
            return `/user/${comps[0]}/group/${comps[1]}/layer/${comps[2]}/feature/${comps[3]}`;
        }
        throw (new Error('wrong number of comps'));
    }
    getParent(comps) {
        if (comps.length > 1) {
            return comps[comps.length - 2];
        }
        return null;
    }
    record(comps, model) {
        const id = model.id;
        const parent = this.getParent(comps);
        let rec;
        if (id in this._db) {
            const oldRec = this._db[id];
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
    }
    update(model) {
        const self = this;
        const db = this._db;
        const record = db[model.id];
        const path = this.makePath(record.comps);
        const resolver = (resolve, reject) => {
            const options = {
                url: this.apiUrl + path,
                body: model,
                parse: () => model,
            };
            self.transport
                .put(options)
                .then(() => {
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
    }
    has(id) {
        return (id in this._db);
    }
    get(id) {
        return (this._db[id].model);
    }
    del(id) {
        delete this._db[id];
    }
    getComps(id) {
        return _.clone(this._db[id].comps);
    }
    lookupKey(prefix) {
        const pat = new RegExp(`^${prefix}.*`);
        const keys = Object.keys(this._db);
        return keys.reduce((acc, key) => {
            if (key.match(pat)) {
                return acc.concat([this.get(key)]);
            }
            return acc;
        }, []);
    }
    lookup(predicate) {
        const filtered = _.filter(this._db, predicate);
        const result = _.map(filtered, (rec) => rec['model']);
        return result;
    }
}
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
class Bind extends EventEmitter {
    constructor(apiUrl) {
        super();
        this.apiUrl = apiUrl;
        this.transport = new Transport_1.Transport();
        this.db = new DB(this.transport, apiUrl);
        this.featurePages = {};
        this.groupCache = {};
        Semaphore_1.semaphore.observe('sync', (message) => {
            const { channel, event, data } = message;
            if ('update' === event) {
                const modelData = data;
                if (this.db.has(modelData.id)) {
                    const model = this.db.get(modelData.id);
                    model._updateData(modelData, false);
                }
            }
            else if ('create' === event) {
                const modelData = data;
                const ctx = channel.type;
                if ('layer' === ctx) {
                    if (!this.db.has(modelData.id)) {
                        const layerId = channel.id;
                        const feature = new waend_lib_1.Feature(modelData);
                        const comps = this.getComps(layerId);
                        comps.push(feature.id);
                        this.db.record(comps, feature);
                        this.changeParent(layerId);
                    }
                }
            }
            else if ('delete' === event) {
                const ctx = channel.type;
                if ('layer' === ctx) {
                    const fid = data;
                    if (this.db.has(fid)) {
                        const layerId = channel.id;
                        this.db.del(fid);
                        this.changeParent(layerId);
                    }
                }
            }
        });
    }
    update(model, key, val) {
        const keys = key.split('.');
        const props = model.getData();
        if (1 === keys.length) {
            props[key] = val;
        }
        else {
            const kl = keys.length;
            let currentDict = props;
            let k;
            for (let i = 0; i < kl; i++) {
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
    }
    updateGeometry(model, geom) {
        if (geom instanceof waend_lib_1.Geometry) {
            model.setGeometry(geom.toGeoJSON());
        }
        else {
            model.setGeometry(geom);
        }
        model.emit('set', 'geom', geom);
        return this.db.update(model);
    }
    changeParent(parentId) {
        if (this.db.has(parentId)) {
            const parent = this.db.get(parentId);
            logger('binder.changeParent', parent.id);
            parent.emit('change');
        }
    }
    getMe() {
        const db = this.db;
        const parse = (response) => {
            const u = new waend_lib_1.User(objectifyResponse(response));
            db.record([u.id], u);
            return u;
        };
        const url = `${this.apiUrl}/auth`;
        return this.transport.get({ url, parse });
    }
    getComps(id) {
        return this.db.getComps(id);
    }
    getUser(userId) {
        const db = this.db;
        const path = `/user/${userId}`;
        if (db.has(userId)) {
            return Promise.resolve(db.get(userId));
        }
        const parse = (response) => {
            const u = new waend_lib_1.User(objectifyResponse(response));
            db.record([userId], u);
            return u;
        };
        const url = this.apiUrl + path;
        return this.transport.get({ url, parse });
    }
    getGroup(userId, groupId) {
        const db = this.db;
        const path = `/user/${userId}/group/${groupId}`;
        if (db.has(groupId)) {
            return Promise.resolve(db.get(groupId));
        }
        const parse = (response) => {
            const groupData = objectifyResponse(response);
            const modelData = {
                id: groupData.group.id,
                properties: groupData.group.properties
            };
            const g = new waend_lib_1.Group(modelData);
            const layers = groupData.group.layers;
            db.record([userId, groupId], g);
            for (const layer of layers) {
                const layerData = {
                    id: layer.id,
                    properties: layer.properties,
                };
                const l = new waend_lib_1.Layer(layerData);
                db.record([userId, groupId, layer.id], l);
                for (const feature of layer.features) {
                    const f = new waend_lib_1.Feature(feature);
                    db.record([userId, groupId, layer.id, feature.id], f);
                }
                Sync_1.subscribe('layer', layer.id);
            }
            Semaphore_1.semaphore.signal('stop:loader');
            Sync_1.subscribe('group', groupId);
            return g;
        };
        const url = this.apiUrl + path;
        Semaphore_1.semaphore.signal('start:loader', 'downloading map data');
        return this.transport.get({ url, parse });
    }
    getGroups(userId) {
        const db = this.db;
        const path = `/user/${userId}/group/`;
        const gc = this.groupCache;
        const parse = (response) => {
            const data = objectifyResponse(response);
            const ret = [];
            for (const groupData of data.results) {
                if (db.has(groupData.id)) {
                    ret.push(db.get(groupData.id));
                }
                else if (groupData.id in gc) {
                    ret.push(gc[groupData.id]);
                }
                else {
                    const g = new waend_lib_1.Group(groupData);
                    gc[groupData.id] = g;
                    ret.push(g);
                }
            }
            return ret;
        };
        const url = this.apiUrl + path;
        return this.transport.get({ url, parse });
    }
    getLayer(userId, groupId, layerId) {
        const db = this.db;
        const path = `/user/${userId}/group/${groupId}/layer/${layerId}`;
        if (db.has(layerId)) {
            return Promise.resolve(db.get(layerId));
        }
        const parse = (response) => {
            const l = new waend_lib_1.Layer(objectifyResponse(response));
            db.record([userId, groupId, layerId], l);
            return l;
        };
        const url = this.apiUrl + path;
        return this.transport.get({ url, parse });
    }
    getLayers(_userId, groupId) {
        return Promise.resolve(this.db.lookup((rec) => rec.parent === groupId));
    }
    getFeature(userId, groupId, layerId, featureId) {
        const db = this.db;
        const path = `/user/${userId}/group/${groupId}/layer/${layerId}/feature/${featureId}`;
        if (db.has(featureId)) {
            return Promise.resolve(db.get(featureId));
        }
        const parse = (response) => {
            const f = new waend_lib_1.Feature(objectifyResponse(response));
            db.record([userId, groupId, layerId, featureId], f);
            return f;
        };
        const url = this.apiUrl + path;
        return this.transport.get({ url, parse });
    }
    delFeature(userId, groupId, layerId, featureId) {
        const feature = (this.db.get(featureId));
        const geom = feature.getGeometry();
        const path = `/user/${userId}/group/${groupId}/layer/${layerId}/feature.${geom.getType()}/${featureId}`;
        const url = this.apiUrl + path;
        const db = this.db;
        const self = this;
        const parse = () => {
            db.del(featureId);
            self.changeParent(layerId);
        };
        return this.transport.del({ url, parse });
    }
    getFeatures(_userId, _groupId, layerId) {
        return Promise.resolve(this.db.lookup(rec => rec.parent === layerId));
    }
    setGroup(userId, data) {
        const db = this.db;
        const binder = this;
        const path = `/user/${userId}/group/`;
        const parse = (response) => {
            const g = new waend_lib_1.Group(objectifyResponse(response));
            db.record([userId, g.id], g);
            binder.changeParent(userId);
            return g;
        };
        const url = this.apiUrl + path;
        return this.transport.post({
            url,
            parse,
            body: data
        });
    }
    setLayer(userId, groupId, data) {
        const db = this.db;
        const binder = this;
        const path = `/user/${userId}/group/${groupId}/layer/`;
        const parse = (response) => {
            const g = new waend_lib_1.Layer(objectifyResponse(response));
            db.record([userId, groupId, g.id], g);
            binder.changeParent(groupId);
            return g;
        };
        const url = this.apiUrl + path;
        return this.transport.post({
            url,
            parse,
            body: data
        });
    }
    setFeature(userId, groupId, layerId, data, batch) {
        const db = this.db;
        const binder = this;
        const path = `/user/${userId}/group/${groupId}/layer/${layerId}/feature/`;
        const parse = (response) => {
            const f = new waend_lib_1.Feature(objectifyResponse(response));
            db.record([userId, groupId, layerId, f.id], f);
            if (!batch) {
                binder.changeParent(layerId);
            }
            return f;
        };
        const url = this.apiUrl + path;
        return this.transport.post({
            url,
            parse,
            body: data
        });
    }
    attachLayerToGroup(guid, groupId, layerId) {
        const path = `/user/${guid}/group/${groupId}/attach/`;
        const data = {
            'layer_id': layerId,
            'group_id': groupId
        };
        const url = this.apiUrl + path;
        return this.transport.post({
            url,
            body: data,
            parse: () => data,
        });
    }
    detachLayerFromGroup(userId, groupId, layerId) {
        const path = `/user/${userId}/group/${groupId}/detach/${layerId}`;
        const url = this.apiUrl + path;
        const parse = () => {
            this.changeParent(groupId);
        };
        return this.transport.del({ url, parse });
    }
    matchKeyAsync(prefix) {
        const res = this.db.lookupKey(prefix);
        if (res.length > 0) {
            return Promise.resolve(res);
        }
        return Promise.reject('No Match');
    }
    matchKey(prefix) {
        return this.db.lookupKey(prefix);
    }
}
exports.Bind = Bind;
let bindInstance;
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
//# sourceMappingURL=Bind.js.map