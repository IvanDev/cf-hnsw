import {
    OpenAPIRoute,
    Path,
    Str,
    DateOnly,
  } from '@cloudflare/itty-router-openapi'
  import {z} from 'zod'

export const AnyObject = z.record(z.string().min(1), z.number())

export const Item = {
    vector: z.array(z.number()),
    data: AnyObject.optional(),
}

export const ResultItem = z.object({
    id: z.number(),
    item: z.object(Item),
    distance: z.number(),
});

export type ResultItemType = z.infer<typeof ResultItem>;
