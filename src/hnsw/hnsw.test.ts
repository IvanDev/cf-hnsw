import { expect, test, beforeAll, beforeEach } from "vitest";
import {HNSW} from "./hnsw";
import {HNSWConfig} from "./types";
import {MemoryStorage} from "../storage";

beforeAll(async () => {

});

beforeEach(async () => {
    // This runs in each tests' isolated storage environment
});

const createHNSW = () => {
    const config: HNSWConfig = {
        M: 16,
        Mmax: 16,
        Mmax0: 32,
        efConstruction: 200,
        efSearch: 200
    }
    const storage = new MemoryStorage();
    return new HNSW(config, storage);
}

test("search", async () => {
    const hnsw = createHNSW();
    await hnsw.addItem(1, new Float32Array([10.0,10.0]));
    await hnsw.addItem(2, new Float32Array([10.0,11.0]));
    await hnsw.addItem(3, new Float32Array([11.0,11.0]));
    await hnsw.addItem(4, new Float32Array([11.0,10.0]));

    expect(await hnsw.search(new Float32Array([12, 12]), 5)).toSatisfy((result: any) => {
        return result[0].node.id === 3;
    });

});

// describe("describe", () => {
//     beforeAll(async () => {
//         const env = getMiniflareBindings();
//         const id = env.VECTOR_STORE.idFromName("test");
//         const storage = await getMiniflareDurableObjectStorage(id);
//         await storage.put("count", 3);
//     });
//     //
//     // beforeEach(async () => {
//     //     await push("describe: beforeEach");
//     // });
//     //
//     // test("test 3", async () => {
//     //     await push(3);
//     //     expect(await get()).toEqual([
//     //         // All beforeAll's run before beforeEach's
//     //         "beforeAll",
//     //         "describe: beforeAll",
//     //         "beforeEach",
//     //         "describe: beforeEach",
//     //         3,
//     //     ]);
//     // });
//     //
//     // test("test 4", async () => {
//     //     await push(4);
//     //     expect(await get()).toEqual([
//     //         "beforeAll",
//     //         "describe: beforeAll",
//     //         "beforeEach",
//     //         "describe: beforeEach",
//     //         4,
//     //     ]);
//     // });
// });