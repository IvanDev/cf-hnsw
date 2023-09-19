
export type HNSWConfig = {
    M: number,
    Mmax: number,
    Mmax0: number,
    efConstruction: number,
    efSearch: number;
    entryPointId: number[],
    randomSeed: number,
}

export type DistanceFunctionType = (a: Float32Array, normA: number | undefined, b: Float32Array, normB: number | undefined) => number;