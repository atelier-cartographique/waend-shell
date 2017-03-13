

type Getter<T> = () => T;


interface EnvStore {
    [key: string]: any;
}

const store: EnvStore = {};

export const set =
    function <T>(key: string, value: T): Getter<T> {
        const getter = () => value;
        store[key] = getter;
        return getter;
    }


export const get =
    function <T>(key: string, def?: T): (null | T) {
        if (key in store) {
            return store[key]();
        }
        if (def) {
            return def;
        }
        return null;
    }

export default { set, get };