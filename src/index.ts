import { OpenAPIRouter } from '@cloudflare/itty-router-openapi'
import { AddItemRoute } from './routes/add'
import { QueryItemsRoute } from './routes/query'

import { VectorStoreDurableObject } from './VectorStoreDurableObject'
import { RequestLike, error } from "itty-router"
import {GetStatRoute} from "./routes/recall";

const errorHandler = (err: any) => {
  // do something fancy with the error
  // await logTheErrorSomewhere({
  //   url: request.url,
  //   error: err.message,
  // })

  // then return an error response to the user/request
  return error(err.status || 500, err.message)
};

const router = OpenAPIRouter()
router.post('/api/item', AddItemRoute)
router.post('/api/query', QueryItemsRoute)
router.get('/api/stat', GetStatRoute);

// 404 for everything else
router.all('*', () => new Response('Not Found.', { status: 404 }))

export default {
  // async fetch(request: RequestLike, ...args: any[]) {
  //   return router.handle(request, ...args).catch(errorHandler)
  // }
  fetch: router.handle,
}

export {
  VectorStoreDurableObject
}