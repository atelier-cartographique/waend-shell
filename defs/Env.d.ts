export declare const setenv: <T>(key: string, value: T) => () => T;
export declare const getenv: <T>(key: string, def?: T | undefined) => T | null;
declare const _default: {
    setenv: <T>(key: string, value: T) => () => T;
    getenv: <T>(key: string, def?: T | undefined) => T | null;
};
export default _default;
