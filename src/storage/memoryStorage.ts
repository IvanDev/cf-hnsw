import { Storage } from "../hnsw/storage";

export class MemoryStorage implements Storage {
    // For testing purposes only, this will use twice the memory of the actual storage

    private storage: Map<string, any> = new Map<string, any>();
    constructor() {

    }

    async get<T = unknown>(key: string): Promise<T | undefined> {
        return this.storage.get(key);
    }

    getMany<T = unknown>(prefix: string): Promise<Map<string, T>> {
        throw new Error("Method not implemented.");
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