import { defineApp } from "convex/server"
import transloadit from "@transloadit/convex/convex.config"

const app = defineApp()
app.use(transloadit)

export default app
