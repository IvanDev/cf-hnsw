import {
    OpenAPIRoute,
    Path,
    Str,
    DateOnly,
} from '@cloudflare/itty-router-openapi'
import {z} from 'zod'
import { EnvironmentBindings } from "../types";
import {QueryItemRequest} from "./query";

export const ClearRequest = z.object({

});

export const ClearResponse = z.object({

});


export class ClearRoute extends OpenAPIRoute {
    static schema = {
        summary: 'Clear index and reset config',
        requestBody: {
            vector: z.array(z.number()),
        },
        responses: {
            '200': {
                description: 'Recall and other statistics',
                schema: {
                    metaData: {},
                    node: ClearResponse
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
        const params: z.infer<typeof QueryItemRequest> = data.body;

        const objectId = env.VECTOR_STORE.idFromName("test");
        const dObj = env.VECTOR_STORE.get(objectId);

        const resp = await dObj.fetch("http://t.com/clear", {
            method: "POST",
            body: JSON.stringify(params),
            headers: {
                "Content-Type": "application/json",
            },
        });

        return await resp.json<z.infer<typeof ClearRequest>>();
    }
}