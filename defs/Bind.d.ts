/// <reference types="node" />
/// <reference types="bluebird" />
import * as Promise from 'bluebird';
import * as EventEmitter from 'events';
import { Transport } from './Transport';
import { Model, BaseModelData, User, Group, Layer, Feature, JSONGeometry } from 'waend-lib';
export interface IRecord {
    readonly model: Model;
    readonly comps: string[];
    readonly parent: string | null;
}
export interface IDBStore {
    [propName: string]: IRecord;
}
export declare class DB extends EventEmitter {
    private apiUrl;
    private transport;
    constructor(t: Transport, apiUrl: string);
    readonly _db: IDBStore;
    makePath(comps: string[]): string;
    getParent(comps: string[]): string | null;
    record(comps: string[], model: Model): IRecord;
    update(model: Model): Promise<Model>;
    has(id: string): boolean;
    get<T extends Model>(id: string): T;
    del(id: string): void;
    getComps(id: string): string[];
    lookupKey(prefix: string): Model[];
    lookup<T extends Model>(predicate: (a: IRecord, b: string) => boolean): T[];
}
export declare class Bind extends EventEmitter {
    private apiUrl;
    private transport;
    private featurePages;
    private groupCache;
    db: DB;
    constructor(apiUrl: string);
    update(model: Model, key: string, val: any): Promise<Model>;
    updateGeometry(model: Feature, geom: JSONGeometry): Promise<Model>;
    changeParent(parentId: string): void;
    getMe(): Promise<User>;
    getComps(id: string): string[];
    getUser(userId: string): Promise<User>;
    getGroup(userId: string, groupId: string): Promise<Group>;
    getGroups(userId: string): Promise<Group[]>;
    getLayer(userId: string, groupId: string, layerId: string): Promise<Layer>;
    getLayers(_userId: string, groupId: string): Promise<Layer[]>;
    getFeature(userId: string, groupId: string, layerId: string, featureId: string): Promise<Feature>;
    delFeature(userId: string, groupId: string, layerId: string, featureId: string): Promise<void>;
    getFeatures(_userId: string, _groupId: string, layerId: string): Promise<Feature[]>;
    setGroup(userId: string, data: BaseModelData): Promise<Group>;
    setLayer(userId: string, groupId: string, data: BaseModelData): Promise<Layer>;
    setFeature(userId: string, groupId: string, layerId: string, data: BaseModelData, batch: boolean): Promise<Feature>;
    attachLayerToGroup(guid: string, groupId: string, layerId: string): Promise<{
        'layer_id': string;
        'group_id': string;
    }>;
    detachLayerFromGroup(userId: string, groupId: string, layerId: string): Promise<void>;
    matchKeyAsync(prefix: string): Promise<any>;
    matchKey(prefix: string): Model[];
}
export declare function getBinder(apiUrl?: string): Bind;
