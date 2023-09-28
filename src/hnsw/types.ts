import {Node} from "./node";

export type HNSWConfig = {
    M: number,
    Mmax: number,
    Mmax0: number,
    efConstruction: number,
    efSearch: number
}

export type ScoreFunctionType = (nodeA: Node, nodeB: Node) => number;