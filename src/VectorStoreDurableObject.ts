import { RequestLike, error } from "itty-router"
import {
    json,
    status,
    StatusError,
    Router,
    withParams,
    withContent
  } from 'itty-router'
import {HNSW, HNSWConfig, Node} from "./hnsw"
import {Storage} from "./storage";
import {DOStorage} from "./storage/durableObjectStorage";

export type VectorStoreDurableObjectBindings = {
    ENVIRONMENT: string
}

const Defaults: { config: HNSWConfig, queryK: number } = {
    config: {
        M: 16,
        Mmax: 16,
        Mmax0: 32,
        efConstruction: 200,
        efSearch: 200
    },
    queryK: 5,
}

export type ItemType = {
    vector: Float32Array | number[],
    data?: Record<string, any> | undefined,
}

export type AddItemsRequest = {
    items: ItemType[],
}

export type ResultItem = {
    id: number,
    item: ItemType,
    score: number,
}

export type QueryItemsRequest = {
    k?: number,
    threshold?: number,
    vector: Float32Array | number[],
}

export type QueryItemsResponse = {
    items: ResultItem[],
}

export class VectorStoreDurableObject implements DurableObject {
    state: DurableObjectState;
    env: VectorStoreDurableObjectBindings;
    router = Router();
    hnsw!: HNSW;
    autoincrement = 0;
    config: HNSWConfig | undefined;
    storage: Storage;

    constructor(state: DurableObjectState, env: VectorStoreDurableObjectBindings) {
        this.state = state;
        this.env = env;
        this.storage = new DOStorage(state.storage);

        this.state.blockConcurrencyWhile(async () => {
            this.autoincrement = await this.state.storage.get('autoincrement') || 0;
            this.config = await this.getConfig();
            this.hnsw = new HNSW(this.config!, this.storage);
        });

        this.router.post('/config', async (request: HNSWConfig) => {
            const params = request;
            await this.setConfig(params);
            return new Response(JSON.stringify(this.config), { status: 200 })
        });

        this.router.post('/add', withContent, async (request) => {
            const params: AddItemsRequest = request.content;

            if (params.items.length === 0) {
                return new Response(JSON.stringify({}), { status: 200 })
            }
            const dimensions = await this.hnsw.getDimensions() || 0;
            for (const item of params.items) {
                const vector = new Float32Array(item.vector);
                if (dimensions > 0 && dimensions !== vector.length) {
                    throw new StatusError(400, 'Vector dimensions does not match index dimension');
                }
                const id = await this.getAutoincrement();
            
                await this.hnsw.addItem(id, vector);
            }

            var result: Node[] = [];
            // for (var i=0; i < this.autoincrement; i++) {
            //     const node = await this.hnsw.nodes.get(i);
            //     if (node) {
            //         result.push(node);
            //     }
            // }

            return new Response(JSON.stringify(result), { status: 200 })
        });

        this.router.post('/query', withContent, async (request) => {
            const params: QueryItemsRequest = request.content;

            const vector = new Float32Array(params.vector);
            
            if (!this.config) {
                throw new StatusError(400, 'Config not set');
            }

            const dimensions = await this.hnsw.getDimensions() || 0;
            if (dimensions > 0 && dimensions !== vector.length) {
                throw new StatusError(400, 'Vector dimensions does not match index dimension');
            }
            //TODO: Add (in memory?) cache for entire query
            const result = await this.hnsw.search(vector, params.k || Defaults.queryK);
            const items: ResultItem[] = result.map((item) => {
                return {
                    id: item.node.id,
                    item: {
                        vector: [],//item.node.vector,
                        data: undefined
                    },
                    score: item.score,
                }
            });
            const response: QueryItemsResponse = {
                items: items,
            }
            return new Response(JSON.stringify(response), { status: 200 })
        });
    }

    async getAutoincrement() {
        await this.state.blockConcurrencyWhile(async () => {
            this.autoincrement += 1;
            await this.state.storage.put('autoincrement', this.autoincrement);
        });
        return this.autoincrement;
    }

    async getConfig(): Promise<HNSWConfig> {
        const config = await this.state.storage.get<HNSWConfig>('config');
        if (config) {
            this.config = config;
        } else {
            this.config = Defaults.config;
            await this.state.storage.put('config', this.config);
        }
        return this.config!;
    }

    async setConfig(config: HNSWConfig) {
        const exConfig = await this.state.storage.get<HNSWConfig>('config');
        if (exConfig) {
            if (exConfig.M !== config.M || exConfig.Mmax !== config.Mmax || exConfig.Mmax0 !== config.Mmax0) {
                throw new StatusError(400, 'M cannot be changed');
            }
            if (exConfig.efConstruction !== config.efConstruction) {
                throw new StatusError(400, 'efConstruction cannot be changed');
            }
        }
        config.M = config.M || Defaults.config.M;
        config.Mmax = config.Mmax || Defaults.config.Mmax;
        config.Mmax0 = config.Mmax0 || Defaults.config.Mmax0;

        config.efConstruction = config.efConstruction || Defaults.config.efConstruction;
        this.config = config;
        await this.state.storage.put('config', config);
    }

    async fetch(request: any, ...args: any[]) {
        return this.router.handle(request, ...args) || error(400, 'Bad request to durable object');
    }
}