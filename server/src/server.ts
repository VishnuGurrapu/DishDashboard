import { createApp } from './app'
import { connectDatabase } from './config/db'
import { config } from './config/env'

export const startServer = async () => {
  try {
    // Connect to MongoDB before the backend starts accepting requests
    await connectDatabase()

    const app = createApp()
    const server = app.listen(config.port, () => {
      console.log(`🚀 Server running on http://localhost:${config.port}`)
      console.log(`🩺 Health check available at http://localhost:${config.port}/health`)
    })

    return server
  } catch (error) {
    console.error('💥 Fatal error starting server:', error)
    process.exit(1)
  }
}

// Start server if this file is run directly
if (process.env.NODE_ENV !== 'test') {
  void startServer()
}
