

type Getter<T> = () => T;


interface EnvStore {
    [key: string]: any;
}

const store: EnvStore = {};

export const setenv =
    function <T>(key: string, value: T): Getter<T> {
        const getter = () => value;
        store[key] = getter;
        return getter;
    }


export const getenv =
    function <T>(key: string, def?: T): (null | T) {
        if (key in store) {
            return store[key]();
        }
        if (def) {
            return def;
        }
        return null;
    }

export default { setenv, getenv };