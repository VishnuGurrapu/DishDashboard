import express, { Application, Request, Response } from 'express'
import cors from 'cors'
import { config } from './config/env'
import { healthRouter } from './routes/health.route'

export const createApp = (): Application => {
  const app = express()

  // Middleware
  app.use(
    cors({
      origin: [config.clientUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true,
    })
  )
  app.use(express.json())

  // Routes
  app.use('/health', healthRouter)

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Route not found' })
  })

  return app
}
