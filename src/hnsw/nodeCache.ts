import { Storage } from "../storage";
import { Node } from "./node";
export class NodeCache {
    public static MAX_CACHE_SIZE = 80 * 1024 * 1024;
    private storage:Storage;
    private cache:Map<number, Node> = new Map();
    private cacheUsage:Map<number, number> = new Map();
    private itemSize: number | undefined;
    private nodeItemPrefix: string = '';

    constructor(storage:Storage, nodeItemPrefix?:string) {
        this.storage = storage;
        this.nodeItemPrefix = nodeItemPrefix || '';
    }

    async clearStaleCacheIfNeeded() {
        if (!this.itemSize) {
            if (this.cache.size > 0) {
                const node = this.cache.values().next().value;
                this.itemSize = node.getObjectSize();
            }
            if (!this.itemSize) {
                return;
            }
        }
        const cacheSize = this.cache.size * this.itemSize;
        const overflow = NodeCache.MAX_CACHE_SIZE - cacheSize;
        if (overflow < 0) {
            const usage = Array.from(this.cacheUsage.keys()).sort((a, b) => {
                return (this.cacheUsage.get(a) || 0) - (this.cacheUsage.get(b) || 0);
            });

            const toRemove = Math.floor(this.cache.size * 0.70); // Keep top 30%
            const keys = usage.slice(0, toRemove);

            keys.forEach((key) => {
                this.cache.delete(key);
            });
            this.cacheUsage.clear(); // Clear usage
        }
    }

    async get(key: number | undefined): Promise<Node | undefined> {
        return (await this.getMany(key))[0];
    }
    async getMany(key: number | number[] | undefined): Promise<Node[]> {
        if (key === undefined) {
            return [];
        }
        let keys: number[] = Array.isArray(key)? Array.from(key) : [key!];
        let result: Map<number, Node> = new Map<number, Node>();
        let missingKeys: number[] = [];

        while (keys.length > 0) {
            const key = keys.pop()!;

            let cached = this.cache.get(key);
            if (cached) {
                result.set(key, cached);
                this.cacheUsage.set(key, (this.cacheUsage.get(key) || 0) + 1);
            } else {
                missingKeys.push(key);
            }
        }

        if (missingKeys.length > 0) {
            const nodes = await this.storage.getMany<any>(missingKeys.map((key) => this.nodeItemPrefix + key.toString()));
            for (const [key, value] of nodes) {
                const node = Node.fromJSON(value);
                if (!node) {
                    continue;
                }
                result.set(node.id, node);
                this.cache.set(node.id, node);
                this.cacheUsage.set(node.id, (this.cacheUsage.get(node.id) || 0) + 1);
            }
            await this.clearStaleCacheIfNeeded();
        }
        return Array.from(result.values());
    }

    async set(value: Node | Node[]): Promise<void> {
        if (!this.itemSize) {
            this.itemSize = Array.isArray(value) ? value[0].getObjectSize() : value.getObjectSize();
        }
        await this.clearStaleCacheIfNeeded();

        if (Array.isArray(value)) {
            let map: Record<string, Node> = {};
            value.forEach((node) => {
                this.cache.set(node.id, node);
                map[this.nodeItemPrefix + node.id.toString()] = node;
                this.cacheUsage.set(node.id, (this.cacheUsage.get(node.id) || 0) + 1);
            });
            await this.storage.put<Node>(map);
        } else {
            this.cache.set(value.id, value);
            this.cacheUsage.set(value.id, (this.cacheUsage.get(value.id) || 0) + 1);
            await this.storage.put<Node>(this.nodeItemPrefix + value.id.toString(), value);
        }
    }

    async deleteAll(): Promise<void> {
        await this.storage.clear();
        this.cache.clear();
        this.cacheUsage.clear();
        this.itemSize = undefined;
    }

    async clear(): Promise<void> {
        this.cache.clear();
        this.cacheUsage.clear();
        this.itemSize = undefined;
    }

    async listAll(onItems: (items: Map<string, Node>) => Promise<void>): Promise<void> {
        await this.storage.listAll<Node>(this.nodeItemPrefix, onItems);
    }

}