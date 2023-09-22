import { NodeCache } from "./nodeCache";
import {ScoreFunctionType, HNSWConfig} from "./types";
import {Node} from "./node";
import {Storage} from "./storage";
import {CandidateItem, CandidateNodeList} from "./candidateList";
import { dotProduct } from "./utils";
import {number} from "zod";

type HNSWState = {
    maxLevel: number | undefined;
    entrypointId: number | undefined;
    dimensions: number | undefined;
}

export class HNSW {
    config: HNSWConfig;
    nodes: NodeCache;
    private levelMult: number;
    private storage: Storage;
    private state!: HNSWState;
    private getScore!: ScoreFunctionType;
    constructor(config: HNSWConfig, storage:Storage) {
        this.config = config;
        this.storage = storage;
        this.nodes = new NodeCache(storage);


        this.config.efConstruction = Math.max(this.config.efConstruction, this.config.M);

        this.levelMult = 1.0 / Math.log(1.0 * this.config.M);
        this.getScore = (a: Float32Array, normA: number | undefined, b: Float32Array, normB: number | undefined) => {
            return 1.0 / ( dotProduct(a, b) / ( (normA || Math.sqrt(dotProduct(a, a))) * (normB || Math.sqrt(dotProduct(b, b))) ) );
        }
    }

    async addItem(id: number, vector: Float32Array) {
        // TODO: Add multiple entry points
        if (this.state === undefined) {
            await this.loadState();
        }
        if (this.state.dimensions !== undefined && vector.length !== this.state.dimensions) {
            throw new Error('All vectors must be of the same dimension');
        }
        this.state.dimensions = vector.length;

        let newLevel = this.getRandomLevel();
        // newLevel = 1;
        const newNode = new Node(id, vector, newLevel);

        if (this.state.entrypointId !== undefined) {
            let closestNode = (await this.nodes.get(this.state.entrypointId))!;
            let level = closestNode.level;
            let closestDistance = Number.MAX_SAFE_INTEGER;

            do  {
                while(true) {
                    let didMove = false;
                    await this.traverseNodes(closestNode, this.config.efConstruction, level, (node) => {
                        const dist = this.getScore(newNode.vector, newNode.norm, node.vector, node.norm);
                        if (dist < closestDistance) {
                            closestNode = node;
                            closestDistance = dist;
                            didMove = true;
                            return true;
                        }
                        return false;

                    });
                    if (!didMove) {
                        break;
                    }
                }
                level--;
            } while (level > newNode.level);

            let affectedNodes = new Set<Node>();
            for (let l = newNode.level; l >= 0 ; l--) {
                const levelM = l == 0 ? this.config.Mmax0 : this.config.Mmax;
                let candidates = new CandidateNodeList(newNode, this.getScore, levelM);
                await this.traverseNodes(closestNode, this.config.efConstruction!, l, (node) => {
                    candidates.add(node);
                    return true;
                });

                for (let i = 0; i < candidates.items.length; i++) {
                    let item = candidates.items[i];

                    item.node.neighbors[l].push(newNode.id);
                    if (item.node.neighbors[l].length > levelM) {
                        item.node.neighbors[l].pop();
                    }
                    affectedNodes.add(item.node);

                    newNode.neighbors[l].push(item.node.id);
                    if (newNode.neighbors[l].length > levelM) {
                        newNode.neighbors[l].pop();
                    }
                }
                if (candidates.items.length) {
                    closestNode = candidates.items[0].node;
                }
            }
            let affectedNodesList = Array.from(affectedNodes);
            for (let i = 0; i < affectedNodesList.length; i++) {
                await this.nodes.set(affectedNodesList[i]);
            }
        }

        if (this.state.entrypointId === undefined || (this.state.maxLevel == undefined || (this.state.maxLevel < newNode.level))) {
            await this.setState({...this.state!, ...{
                    maxLevel: Math.max(this.state.maxLevel || 0, newNode.level),
                    entrypointId: newNode.id }
                });
        }

        await this.nodes.set(newNode);
    }

    private async traverseNodes(entryNode: Node, ef: number, level: number, onNode: (node:Node)=>Boolean, visited?:Set<number> ): Promise<Node[]> {
        if (!visited) {
            visited = new Set<number>();
        }

        if (entryNode.level < level || visited.size > ef) {
            return [];
        }
        let result = new Array<Node>();
        if (!visited.has(entryNode.id)) {
            visited.add(entryNode.id);
            if (onNode(entryNode)) {
                result.push(entryNode);
            }
        }
        for (let i = 0; i<entryNode.neighbors[level].length; i++) {
            const neighborId = entryNode.neighbors[level][i];
            if (!visited.has(neighborId)) {
                const neighbor = (await this.nodes.get(neighborId))!;
                visited.add(neighborId);
                if (onNode(neighbor)) {
                    result.push(neighbor);
                    result = result.concat(await this.traverseNodes(neighbor, ef, level, onNode, visited));
                }
            }
            if (visited.size > ef) {
                break;
            }
        }
        return result;
    }

    async search(query: Float32Array, k: number): Promise<CandidateItem[]> {
        if (this.state === undefined) {
            await this.loadState();
        }
        if (this.state.dimensions === undefined) {
            throw new Error('Dimensions not set');
        }
        if (this.state.dimensions !== undefined && query.length !== this.state.dimensions) {
            throw new Error('All vectors must be of the same dimension');
        }
        if (this.state.entrypointId !== undefined) {
            let closestNode = (await this.nodes.get(this.state.entrypointId))!;
            let level = closestNode.level;
            let closestDistance = Number.MAX_SAFE_INTEGER;
            let queryNorm = dotProduct(query, query);
            do {
                while (true) {
                    let didMove = false;
                    await this.traverseNodes(closestNode, this.config.efSearch, level, (node) => {
                        const dist = this.getScore(query, queryNorm, node.vector, node.norm);
                        if (dist < closestDistance) {
                            closestNode = node;
                            closestDistance = dist;
                            didMove = true;
                            return true;
                        }
                        return false;
                    });
                    if (!didMove) {
                        break;
                    }
                }
                level--;
            } while (level >= 0);

            let candidates = new CandidateNodeList(closestNode, this.getScore, k);
            await this.traverseNodes(closestNode, this.config.efSearch!, 0, (node) => {
                candidates.add(node);
                return true;
            });
            return candidates.items;
        } else {
            return [];
        }
    }

    getRandomLevel(): number {
        const r = -1.0 * Math.log(this.getRandomNumber()) * this.levelMult;
        return Math.floor(r);
    }
    async setState(state: HNSWState) {
        this.state = state;
        await this.storage.put('hnsw_state', state);
    }
    async loadState(): Promise<HNSWState> {
        if (!this.state) {
            this.state = await this.storage.get<HNSWState>('hnsw_state') || {
                maxLevel: undefined,
                entrypointId: undefined,
                dimensions: undefined,
            };
        }
        return this.state;
    }

    async getDimensions(): Promise<number | undefined> {
        if (this.state === undefined) {
            await this.loadState();
        }
        return this.state?.dimensions;
    }

    private getRandomNumber() {
        return Math.random();
    }
}