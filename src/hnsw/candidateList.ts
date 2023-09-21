import {Node} from "./node";
import {DistanceFunctionType} from "./types";

export type CandidateItem = {
    node: Node,
    distance: number,
}
export class CandidateNodeList {
    public items: CandidateItem[] = [];
    private readonly targetNode: Node;
    private readonly maxLength: number;
    private readonly distanceFunction: DistanceFunctionType;

    constructor(target: Node, distanceFunction: DistanceFunctionType, maxLength: number) {
        this.targetNode = target;
        this.maxLength = maxLength;
        this.distanceFunction = distanceFunction;
    }

    public add(node: Node) {
        let lastNode = this.items[this.items.length - 1];
        const dist = this.distanceFunction(node.vector, node.norm, this.targetNode.vector, this.targetNode.norm);
        if (lastNode === undefined) {
            this.items.push({node, distance: dist});
        } else {
            let i = this.items.length - 1;
            while (i >= 0 && this.items[i].distance > dist) {
                i--;
            }
            this.items.splice(i + 1, 0, {node, distance: dist});
        }
        if (this.items.length > this.maxLength) {
            this.items.pop();
        }
    }
}