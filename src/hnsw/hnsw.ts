import { NodeCache } from "./nodeCache";
import {ScoreFunctionType, HNSWConfig} from "./types";
import {Node} from "./node";
import {Storage} from "./storage";
import {CandidateItem, CandidateNodeList} from "./candidateList";
import { dotProduct } from "./utils";

type HNSWState = {
    maxLevel: number | undefined;
    entrypointId: number | undefined;
    dimensions: number | undefined;
}

function euclideanDistance(a: Float32Array | number[], b: Float32Array | number[]): number {
    let sum = 0.0;
    const len = a.length;
    for (let i = 0; i < len; i++) {
        const diff = (a[i] - b[i]);
        sum += diff * diff;
    }
    return sum;
}
//TODO: refactor getScore to use wasm
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
        this.nodes = new NodeCache(storage, 'hnsw_node_');

        this.config.efConstruction = Math.max(this.config.efConstruction, this.config.M);
        this.levelMult = 1.0 / Math.log(1.0 * this.config.M);
        this.getScore = (nodeA: Node, nodeB: Node) => {
            return 1.0 - ( dotProduct(nodeA.vector, nodeB.vector) / ( (nodeA.norm || Math.sqrt(dotProduct(nodeA.vector, nodeA.vector))) * (nodeB.norm || Math.sqrt(dotProduct(nodeB.vector, nodeB.vector))) ) );
            // return euclideanDistance(nodeA.vector, nodeB.vector);
            // const len = a.length;
            // let result = 0.0;
            // for (let i = 0; i < len; i++) {
            //     result += (a[i] - b[i]) ** 2;
            // }
            // return result;
        }
    }

    async addItem(id: number, vector: Float32Array, nodeLevel?: number): Promise<void> {
        // TODO: Add multiple entry points
        if (this.state === undefined) {
            await this.loadState();
        }
        if (this.state.dimensions !== undefined && vector.length !== this.state.dimensions) {
            throw new Error('All vectors must be of the same dimension');
        }
        this.state.dimensions = vector.length;
        if (await this.nodes.get(id) !== undefined) {
            throw new Error('Item with id (' + id + ') already exists');
        }

        let newLevel = nodeLevel || this.getRandomLevel();
        // newLevel = 1;
        const newNode = new Node(id, vector, newLevel);

        if (this.state.entrypointId !== undefined) {
            let closestNode = <Node>(await this.nodes.get(this.state.entrypointId))!;
            let level = closestNode.level;
            let closestDistance = Number.MAX_SAFE_INTEGER;

            do  {
                while(true) {
                    let didMove = false;
                    await this.traverseNodes(closestNode, closestNode.neighbors[level].length + 1, level, (node, visited) => {
                        const dist = this.getScore(newNode, node);
                        if (dist < closestDistance) {
                            closestNode = node;
                            closestDistance = dist;
                            didMove = true;
                            return false;
                        }
                        // return false;
                        return true;//visited.size <= closestNode.neighbors[level].length + 1
                    });
                    if (!didMove) {
                        break;
                    }
                }
                level--;
            } while (level > newNode.level);

            let affectedNodes = new Map<number, Node>();
            for (let l = Math.min(closestNode.level, newNode.level); l >= 0 ; l--) {
                const levelM = l == 0 ? this.config.Mmax0 : this.config.Mmax;
                let candidates = new CandidateNodeList(newNode, this.getScore, levelM);
                candidates.add(closestNode);
                await this.traverseNodes(closestNode, this.config.efConstruction!, l, (node, visited) => {
                    candidates.add(node);
                    return true;//(visited.size < this.config.efConstruction!);
                });

                candidates = await this.filterCandidatesByHeuristic(candidates, levelM);
                newNode.neighbors[l] = [];
                for (let i = 0; i < candidates.items.length; i++) {
                    let item = candidates.items[i];

                    if (item.node.neighbors[l].length < levelM) {
                        item.node.neighbors[l].push(newNode.id);
                    } else {
                        let neighbourCandidates = new CandidateNodeList(item.node, this.getScore, levelM);
                        neighbourCandidates.add(newNode);
                        for (let j = 0; j < item.node.neighbors[l].length; j++) {
                            const neighbor = (await this.nodes.get( item.node.neighbors[l][j] ))!;
                            neighbourCandidates.add(neighbor);
                        }
                        neighbourCandidates = await this.filterCandidatesByHeuristic(neighbourCandidates, levelM);

                        item.node.neighbors[l] = [];
                        for (let k = 0; k < neighbourCandidates.items.length; k++) {
                            item.node.neighbors[l].push(neighbourCandidates.items[k].node.id);
                        }
                    }
                    // item.node.neighbors[l].push(newNode.id);
                    // if (item.node.neighbors[l].length > levelM) {
                    //     item.node.neighbors[l].pop();
                    // }
                    affectedNodes.set(item.node.id, item.node);

                    newNode.neighbors[l].push(item.node.id);
                    if (newNode.neighbors[l].length > levelM) {
                        newNode.neighbors[l].pop();
                    }
                }
                if (candidates.items.length) {
                    closestNode = candidates.items[0].node;
                }

            }
            affectedNodes.set(newNode.id, newNode);
            await this.nodes.set(Array.from(affectedNodes.values()));
        } else {
            await this.nodes.set(newNode);
        }

        if (this.state.entrypointId === undefined || (this.state.maxLevel == undefined || (this.state.maxLevel < newNode.level))) {
            await this.setState({...this.state!, ...{
                maxLevel: Math.max(this.state.maxLevel || 0, newNode.level),
                entrypointId: newNode.id }
            });
        }
    }
    private async filterCandidatesByHeuristic(candidates: CandidateNodeList, M: number): Promise<CandidateNodeList> {
        if (candidates.items.length < M) {
            return candidates;
        }
        let result: CandidateItem[] = [];
        for (let i=0; i<candidates.items.length; i++) {
            const item = candidates.items[i];
            if (result.length >= M) {
                break;
            }
            let distanceToQuery = item.score;
            let shouldAdd = true;
            for (let j=0; j<result.length; j++) {
                const resultItem = result[j];
                const dist = this.getScore(resultItem.node, item.node);
                if (dist < distanceToQuery) {
                    shouldAdd = false;
                    break;
                }
            }
            if (shouldAdd) {
                result.push(item);
            }
        }
        const resultCandidates = new CandidateNodeList(candidates.targetNode, this.getScore, M);
        result.forEach((item) => {
            resultCandidates.add(item.node);
        });
        return resultCandidates;
    }
    private async traverseNodes(entryNode: Node, ef: number, level: number, onNode: (node:Node, visited:Map<number, number>)=>Boolean, visited?:Map<number, number> ): Promise<void> {
        if (!visited) {
            visited = new Map<number, number>();
        }

        if (entryNode.level < level || visited.size > ef) {
            return;
        }

        let candidates: number[] = [];
        candidates.push(entryNode.id);
        while (candidates.length > 0) {
            const nodeId = candidates.shift()!;
            if (visited.size >= ef) {
                return;
            }
            if (!visited.has(nodeId)) {
                visited.set(nodeId, nodeId);

                const node = await this.nodes.get(nodeId);
                if (!node) {
                    continue;
                }
                const neighbourNodes: Node[] = await this.nodes.getMany(node.neighbors[level]);

                const len = neighbourNodes.length;
                for (let i = 0; i < len; i++) {
                    const neighborNode = neighbourNodes[i];
                    if (!visited.has(neighborNode.id)) {
                        if (!onNode(neighborNode, visited)) {
                            return;
                        }
                        candidates.push(neighborNode.id);
                    }
                    if (visited.size >= ef) {
                        return;
                    }
                }
            }
        }
    };

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
            let closestNode = <Node>(await this.nodes.get(this.state.entrypointId))!;
            let level = closestNode.level;
            const queryNode = new Node(-1, query, 0);
            let closestDistance = this.getScore(queryNode, closestNode);

            while (level > 0) {
                while (true) {
                    let didMove = false;
                    const maxNodes = closestNode.neighbors[level].length + 1;
                    await this.traverseNodes(closestNode, maxNodes, level, (node, visited) => {
                        const dist = this.getScore(queryNode, node);
                        if (dist < closestDistance) {
                            closestNode = node;
                            closestDistance = dist;
                            didMove = true;
                            return false;
                            // return true;
                        }
                        // return false;
                        return true;//visited.size <= maxNodes;
                    });
                    if (!didMove) {
                        break;
                    }
                }
                level--;
            }

            let candidates = new CandidateNodeList(queryNode, this.getScore, k);
            candidates.add(closestNode);
            await this.traverseNodes(closestNode, this.config.efSearch!, 0, (node, visited) => {
                candidates.add(node);
                return true;//(visited.size < this.config.efSearch!);
            });
            return candidates.items.slice(0, k);
        } else {
            return [];
        }
    }

    async calcRecall(): Promise<{ recall: number, total: number }> {
        let result = 0.0;
        let total = 0;
        await this.nodes.clear();
        await this.nodes.listAll(async (items) => {
            for (const [key, value] of items) {
                const node = Node.fromJSON(value);
                const candidates = await this.search(node.vector, 1);
                const found = candidates.find((item) => item.node.id === node.id);
                if (found) {
                    result += 1.0;
                }
                total++;
            }
        });
        if (total === 0) {
            return { recall: 0.0, total: 0 };
        }
        return { recall: result / total, total };
    }

    getRandomLevel(): number {
        const r = -1.0 * Math.log(this.getRandomNumber()) * this.levelMult;
        return Math.ceil(r);
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

    async deleteAll(): Promise<void> {
        await this.nodes.deleteAll();
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