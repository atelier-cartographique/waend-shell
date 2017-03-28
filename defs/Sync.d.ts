import { ModelData } from "waend-lib";
export interface IChannel {
    type: string;
    id: string;
}
export declare type ISyncEvent = 'update' | 'create' | 'delete';
export interface ISyncMessage {
    channel: IChannel;
    event: ISyncEvent;
    data: ModelData | string;
}
export declare function configure(url: string): void;
export declare function send(...args: any[]): boolean;
export declare function subscribe(type: string, id: string): void;
