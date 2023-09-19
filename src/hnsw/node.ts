import { VectorType } from "./types";

export class Node {
    id: number;
    vector: Float32Array;
    neighbors: number[][];
    level: number;
    private _norm: number | undefined;

    constructor(id: number, vector: Float32Array, level: number, neighbors?: number[][]) {
        this.id = id;
        this.vector = vector;
        this.level = level;
        this.neighbors = neighbors ? neighbors : new Array(level + 1).fill(new Array(0));
    }

    static fromJSON(json: any): Node {
        const node = new Node(json.id, json.vector, json.level, json.neighbors[0].length);
        node._norm = json._norm;
        node.neighbors = json.neighbors;
        return node;
    }

    getObjectSize() {
        // Assuming M=20
        return Float32Array.BYTES_PER_ELEMENT * this.vector.length + this.neighbors.length * 20 * 4;
    }

    get norm(): number {
        if (!this._norm) {
            let dP: number = 0.0;
            const len = this.vector.length;
            for (let i = 0; i < len; i++) {
                let val = this.vector[i];
                dP += val * val;
            }
            this._norm = Math.sqrt(dP);
        }
        return this._norm;
    }
}