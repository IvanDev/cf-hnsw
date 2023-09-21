import {
    OpenAPIRoute,
    Path,
    Str,
    DateOnly,
  } from '@cloudflare/itty-router-openapi'
  import {z} from 'zod'
  import { Item, ResultItem } from "./types";
  import { EnvironmentBindings } from "../types";

  export const QueryItemRequest = z.object({
    k: z.number().optional(),
    threshold: z.number().optional(),
    vector: z.array(z.number()),
  });
  
  export const QueryItemsResponse = z.object({
    items: z.array(z.object(ResultItem)),
  });
  
  
  export class QueryItemsRoute extends OpenAPIRoute {
    static schema = {
      summary: 'Query vector in HNSW index',
      requestBody: {
        vector: z.array(z.number()),
      },
      responses: {
        '200': {
          description: 'Node added',
          schema: {
            metaData: {},
            node: QueryItemsResponse,
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
  
      const resp = await dObj.fetch("http://t.com/query", {
        method: "POST",
        body: JSON.stringify(params),
        headers: {
          "Content-Type": "application/json",
        },
      });

      return await resp.json<z.infer<typeof QueryItemsResponse>>();
    }
  }