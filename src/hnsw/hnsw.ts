import { NodeCache } from "./nodeCache";
import {DistanceFunctionType, HNSWConfig} from "./types";
import {Node} from "./node";
import {Storage} from "./storage";
import {CandidateNodeList} from "./candidateList";
import {innerProductDistanceFunction} from "./distanceFunction";

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
    private getDistance!: DistanceFunctionType;
    constructor(config: HNSWConfig, storage:Storage) {
        this.config = config;
        this.storage = storage;
        this.nodes = new NodeCache(storage);


        this.config.efConstruction = Math.max(this.config.efConstruction, this.config.M);

        this.levelMult = 1 / Math.log(1.0 * this.config.M);
        this.getDistance = innerProductDistanceFunction;
        // add Mmax and Mmax0

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

        const newNode = new Node(id, vector, this.getRandomLevel());
        if (this.state.maxLevel == undefined || (this.state.maxLevel < newNode.level)) {
            await this.setState({...this.state!, ...{ maxLevel: Math.max(this.state.maxLevel || 0, newNode.level) }});
        }

        if (this.state.entrypointId !== undefined) {
            let level = this.state.maxLevel!;
            let closestNode = (await this.nodes.get(this.state.entrypointId))!;
            let closestDistance = this.getDistance(newNode.vector, undefined, closestNode.vector, undefined);;

            do  {
                await this.traverseNodes(closestNode, this.config.efConstruction!, level, (node) => {
                    const dist = this.getDistance(newNode.vector, undefined, node.vector, undefined);
                    if (dist < closestDistance) {
                        closestNode = node;
                        closestDistance = dist;
                    }
                    return true;
                });
                level--;
            } while (level > newNode.level);

            let affectedNodes = new Set<Node>();
            for (let l = level + 1; l >= 0 ; l--) {
                const levelM = l == 0 ? this.config.Mmax0 : this.config.Mmax;
                let candidates = new CandidateNodeList(newNode, this.getDistance, levelM);
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
            }
            let affectedNodesList = Array.from(affectedNodes);
            for (let i = 0; i < affectedNodesList.length; i++) {
                await this.nodes.set(affectedNodesList[i]);
            }
        } else {
            this.state.entrypointId = newNode.id;
            await this.setState({...this.state!, ...{ entrypointId: this.state.entrypointId }});
        }
        await this.nodes.set(newNode);
    }

    private async traverseNodes(entryNode: Node, ef: number, level: number, onNode: (node:Node)=>Boolean, visited?:Set<number> ): Promise<Node[]> {
        if (!visited)
            visited = new Set<number>();
        if (entryNode.neighbors.length <= level || visited.size > ef) {
            return [];
        }
        let result = new Array<Node>();
        if (!visited.has(entryNode.id)) {
            if (onNode(entryNode)) {
                result.push(entryNode);
            }
            visited.add(entryNode.id);
        }
        for (let i = 0; i<entryNode.neighbors[level].length; i++) {
            const neighborId = entryNode.neighbors[level][i];
            if (!visited.has(neighborId)) {
                const neighbor = (await this.nodes.get(neighborId))!;
                if (onNode(neighbor)) {
                    result.push(neighbor);
                    visited.add(neighborId);
                }
                result = result.concat(await this.traverseNodes(neighbor, ef, level, onNode, visited));
            }
        }
        return result;
    }

    // private async searchNodes(query: VectorType, k: number, stopAtLevel: number = 0): Promise<Node | undefined> {
    //     if (this.state === undefined) {
    //         await this.loadState();
    //     }
    //     if (this.state.entrypointId === undefined) {
    //         return undefined;
    //     } else {
    //
    //     }
    // }
    //
    // async search(query: VectorType, k: number): Promise<Node | undefined> {
    //     if (this.state === undefined) {
    //         await this.loadState();
    //     }
    //     if (this.state.dimensions !== undefined && query.length !== this.state.dimensions) {
    //         throw new Error('All vectors must be of the same dimension');
    //     }
    //     return this.searchNode(query);
    // }


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