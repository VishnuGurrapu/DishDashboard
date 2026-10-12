import { Router, Request, Response } from 'express'

export const healthRouter = Router()

healthRouter.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    message: 'Nosh Dish Dashboard API is healthy',
    timestamp: new Date().toISOString(),
  })
})
