import { createApp } from './app'
import { config } from './config/env'

const app = createApp()

const server = app.listen(config.port, () => {
  console.log(`🚀 Server running on http://localhost:${config.port}`)
  console.log(`🩺 Health check available at http://localhost:${config.port}/health`)
})

export default server
