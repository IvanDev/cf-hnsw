export function dotProduct(a: Float32Array, b: Float32Array): number {
    let result: number = 0.0;
    const len = a.length;
    for (let i = 0; i < len; i++)
        result+=a[i]*b[i];
    return result;
}
