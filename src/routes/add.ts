import {
  OpenAPIRoute,
  Path,
  Str,
  DateOnly,
} from "@cloudflare/itty-router-openapi";
import { z } from "zod";
import { EnvironmentBindings } from "../types";
import { Item, ResultItem } from "./types";

export const AddItemsRequest = z.object({
  items: z.array(z.object(Item)),
});

export const AddItemsResponse = z.object({
  success: z.boolean(),
});

export class AddItemRoute extends OpenAPIRoute {
  static schema = {
    tags: ["Tasks"],
    summary: "Add node to HNSW index",
    requestBody: AddItemsRequest,
    responses: {
      "200": {
        description: "Node added",
        schema: AddItemsResponse,
      },
    },
  };

  async handle(
    request: Request,
    env: EnvironmentBindings,
    context: any,
    data: any
  ) {
    const params: z.infer<typeof AddItemsRequest> = data.body;

    const objectId = env.VECTOR_STORE.idFromName("test");
    const dObj = env.VECTOR_STORE.get(objectId);

    const resp = await dObj.fetch("http://t.com/add", {
      method: "POST",
      body: JSON.stringify(params),
      headers: {
        "Content-Type": "application/json",
      },
    });
    return await resp.json<z.infer<typeof AddItemsResponse>>();
  }
}
