import { expect, test, beforeAll, beforeEach } from "vitest";
import {HNSW} from "./hnsw";
import {HNSWConfig} from "./types";
import {MemoryStorage, Storage} from "../storage";
import seedrandom from "seedrandom";

beforeAll(async () => {

});

beforeEach(async () => {
    // This runs in each tests' isolated storage environment
});
const createHNSW = (storage?: Storage) => {
    const config: HNSWConfig = {
        M: 46,
        Mmax: 46,
        Mmax0: 92,
        efConstruction: 200,
        efSearch: 200
    }
    storage = storage || new MemoryStorage();
    return new HNSW(config, storage);
}

const addData = async (hnsw: HNSW) => {

}

test("search", async () => {
    const hnsw = createHNSW();

    await hnsw.addItem(1, new Float32Array([0.0,0.0]), 0);
    await hnsw.addItem(2, new Float32Array([0.0,1.0]), 0);
    await hnsw.addItem(3, new Float32Array([1.0,1.0]), 0);
    await hnsw.addItem(4, new Float32Array([1.0,0.0]), 0);
    // await hnsw.addItem(5, new Float32Array([5.0,9.0]), 1);
    const result = await hnsw.search(new Float32Array([5, 5]), 5);
    // expect(result[0].node.id).toBe(1);
});



//
test("search", async () => {
    function euclideanDistance(a: Float32Array | number[], b: Float32Array | number[]): number {
        let sum = 0.0;
        const len = a.length;
        for (let i = 0; i < len; i++) {
            sum += (a[i] - b[i]) ** 2;
        }
        return Math.sqrt(sum);
    }

    const hnsw = createHNSW();
    const totalItems = 1000;
    const d = 768*2;
    let rng = seedrandom('hnsw');

    let vectors: Float32Array[] = [];

    for (let i = 1; i < totalItems + 1; i++) {
        const vector = new Float32Array(new Array(d).fill(0).map(() => rng()));
        await hnsw.addItem(i, vector);
    }

    rng = seedrandom('hnsw');

    console.log(await hnsw.calcRecall());

    // for (let i = 1; i < totalItems + 1; i++) {
    //     const vector = new Float32Array(new Array(d).fill(0).map(() => rng()));
    //     const result = await hnsw.search(vector, 5);
    //     // if (result[0].node.id !== i) {
    //     //     console.log(i, result[0].score, euclideanDistance(vector, result[0].node.vector), result[0].node.vector, vector);
    //     // }
    //     expect(result[0].node.id).toBe(i);
    // }

    // expect(await hnsw.search(new Float32Array([12, 12]), 5)).toSatisfy((result: any) => {
    //     return result[0].node.id === 3;
    // });
});
