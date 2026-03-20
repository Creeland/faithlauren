import { createRouteHandler } from "uploadthing/next"
import { uploadRouter } from "./core"

export const maxDuration = 60

export const { GET, POST } = createRouteHandler({ router: uploadRouter })
