import {DistanceFunctionType} from "./types";

function innerProduct(a: Float32Array, b: Float32Array): number {
    let result: number = 0.0;
    const len = a.length;
    for (let i = 0; i < len; i++)
        result+=a[i]*b[i];
    return result;
}

export const innerProductDistanceFunction: DistanceFunctionType = (a: Float32Array, normA: number | undefined, b: Float32Array, normB: number | undefined): number => {
    return 1.0 - innerProduct(a, b);
}