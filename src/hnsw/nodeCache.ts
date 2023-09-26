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
            return;
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
        if (key === undefined) {
            return undefined;
        }
        let cached = this.cache.get(key);
        let node: Node | undefined = cached;
        if (!cached) {
            const val = await this.storage.get<Node>(this.nodeItemPrefix + key.toString());
            if (val) {
                node = Node.fromJSON(val);
            }
        }
        this.cacheUsage.set(key, (this.cacheUsage.get(key) || 0) + 1);

        if (node) {
            if (!this.itemSize) {
                this.itemSize = node.getObjectSize();
            }

            if (!cached) {
                await this.clearStaleCacheIfNeeded();
                this.cache.set(key, node);
            }
            return node;
        } else {
            return undefined;
        }
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

    async clear(): Promise<void> {
        await this.storage.clear();
        this.cache.clear();
        this.cacheUsage.clear();
        this.itemSize = undefined;
    }

    async listAll(onItems: (items: Map<string, Node>) => Promise<void>): Promise<void> {
        await this.storage.listAll<Node>(this.nodeItemPrefix, onItems);
    }

}