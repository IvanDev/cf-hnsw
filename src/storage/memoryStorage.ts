import { Storage } from "../hnsw/storage";

export class MemoryStorage implements Storage {
    // For testing purposes only, this will use twice the memory of the actual storage

    private storage: Map<string, any> = new Map<string, any>();
    constructor() {

    }

    async listAll<T = unknown>(prefix: string, onItems: (items: Map<string, T>) => Promise<void>): Promise<void> {
        let items: Map<string, T> = new Map<string, T>();
        for (const [key, value] of this.storage) {
            if (!key.startsWith(prefix)) {
                continue;
            }
            items.set(key, value);
            if (items.size >= 100) {
                await onItems(items);
                items = new Map<string, T>();
            }
        }
        if (items.size > 0) {
            await onItems(items);
        }
    }

    async get<T = unknown>(key: string): Promise<T | undefined> {
        return this.storage.get(key);
    }

    getMany<T = unknown>(keys: string[]): Promise<Map<string, T>> {
        let result = new Map<string, T>();
        for (const key of keys) {
            result.set(key, this.storage.get(key));
        }
        return Promise.resolve(result);
    }

    put<T = unknown>(key: string, value: T): Promise<void>;
    put<T = unknown>(items: Record<string, T>): Promise<void>;
    async put<T = unknown>(keyOrItems: string | Record<string, T>, value?: T): Promise<void> {
        if (typeof keyOrItems === 'string') {
            this.storage.set(keyOrItems, value!);
        } else {
            for (const key in keyOrItems) {
                this.storage.set(key, keyOrItems[key]);
            }
        }
        return Promise.resolve();
    }

    async clear(): Promise<void> {
        this.storage.clear();
        return Promise.resolve();
    }
}