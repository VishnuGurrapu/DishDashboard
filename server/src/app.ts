import express, {
  Application,
  Request,
  Response,
  NextFunction,
  ErrorRequestHandler,
} from 'express'
import cors from 'cors'
import { config } from './config/env'
import { healthRouter } from './routes/health.route'
import { dishRouter } from './routes/dish.route'

export const errorHandler: ErrorRequestHandler = (
  err: any,
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (res.headersSent) {
    return next(err)
  }

  if (err && typeof err === 'object' && err.type === 'entity.parse.failed') {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid JSON body',
    })
    return
  }

  res.status(500).json({
    error: 'Internal Server Error',
    message: 'Unexpected error',
  })
}

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
  app.use('/dishes', dishRouter)

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Route not found' })
  })

  // Error handling middleware
  app.use(errorHandler)

  return app
}

