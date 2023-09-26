import {
    OpenAPIRoute,
    Path,
    Str,
    DateOnly,
} from '@cloudflare/itty-router-openapi'
import {z} from 'zod'
import { EnvironmentBindings } from "../types";

export const StatRequest = z.object({

});

export const StatResponse = z.object({
    total: z.number(),
    recall: z.number(),
});


export class GetStatRoute extends OpenAPIRoute {
    static schema = {
        summary: 'Get index stats',
        requestBody: {
            vector: z.array(z.number()),
        },
        responses: {
            '200': {
                description: 'Recall and other statistics',
                schema: {
                    metaData: {},
                    node: StatResponse
                },
            },
        },
    }

    async handle(
        request: Request,
        env: EnvironmentBindings,
        context: any,
        data: any
    ) {
        const objectId = env.VECTOR_STORE.idFromName("test");
        const dObj = env.VECTOR_STORE.get(objectId);

        const resp = await dObj.fetch("http://t.com/recall", {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        });

        return await resp.json<z.infer<typeof StatResponse>>();
    }
}