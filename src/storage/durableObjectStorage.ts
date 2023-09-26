import { Storage } from "../hnsw/storage";

export class DOStorage implements Storage {
    private storage: DurableObjectStorage;
    constructor(storage: DurableObjectStorage) {
        this.storage = storage;
    }

    async get<T = unknown>(key: string): Promise<T | undefined> {
        return await this.storage.get<T>(key);
    }

    async getMany<T = unknown>(prefix: string): Promise<Map<string, T>> {
        return await this.storage.list<T>({ prefix: prefix });
    }

    async listAll<T = unknown>(prefix: string, onItems: (items: Map<string, T>) => Promise<void>): Promise<void> {
        let startAfter: string | undefined = undefined;
        do {
            const items: Map<string, T> = await this.storage.list<T>({ prefix: prefix, limit: 100, startAfter: startAfter });
            await onItems(items);
            startAfter = undefined;
            if (items.size > 0) {
                startAfter = [...items.keys()][items.size - 1];
            }
        } while (startAfter !== undefined);
    }

    put<T = unknown>(key: string, value: T): Promise<void>;
    put<T = unknown>(items: Record<string, T>): Promise<void>;
    async put<T = unknown>(keyOrItems: string | Record<string, T>, value?: T): Promise<void> {
        if (typeof keyOrItems === 'string') {
            await this.storage.put<T>(keyOrItems, value!);
        } else {
            await this.storage.put<T>(keyOrItems);
        }
    }

    async clear(): Promise<void> {
        await this.storage.deleteAll();
    }
}