import {Node} from "./node";
import {ScoreFunctionType} from "./types";

export type CandidateItem = {
    node: Node,
    score: number,
}
export class CandidateNodeList {
    public items: CandidateItem[] = [];
    public readonly targetNode: Node;
    private readonly maxLength: number;
    private readonly distanceFunction: ScoreFunctionType;

    constructor(target: Node, distanceFunction: ScoreFunctionType, maxLength: number) {
        this.targetNode = target;
        this.maxLength = maxLength;
        this.distanceFunction = distanceFunction;
    }

    public add(node: Node) {
        if (this.items.find((item) => item.node.id === node.id)) {
            return;
        }

        let lastNode = this.items[this.items.length - 1];
        const dist = this.distanceFunction(node, this.targetNode);
        if (lastNode === undefined) {
            this.items.push({node, score: dist});
        } else {


            let i = this.items.length - 1;
            while (i >= 0 && this.items[i].score > dist) {
                i--;
            }
            this.items.splice(i + 1, 0, {node, score: dist});
            // let didAdd = false;
            // for (let j = this.items.length - 1; j >= 0; j--) {
            //     if (this.items[j].score < dist) {
            //         this.items.splice(j + 1, 0, {node, score: dist});
            //         didAdd = true;
            //         break;
            //     }
            // }
            // if ((didAdd == false) && (this.items.length < this.maxLength)) {
            //    this.items.unshift({node, score: dist});
            // }

            // this.items.push({node, score: dist});
            // this.items.sort((a, b) => a.score - b.score);
        }
        if (this.items.length > this.maxLength) {
            this.items.pop();
        }
    }

    pop(): CandidateItem | undefined {
        return this.items.shift();
    }
}