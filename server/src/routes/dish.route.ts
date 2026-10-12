import { Router, Request, Response } from 'express'
import { ZodError } from 'zod'
import {
  dishIdParamSchema,
  updateDishSchema,
} from '../schemas/dish.schema'
import {
  getAllDishes,
  updateDishSafely,
} from '../services/dish.service'

export const dishRouter = Router()

/**
 * GET /dishes
 * Retrieves all dishes from MongoDB.
 */
dishRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const dishes = await getAllDishes()
    res.status(200).json({
      dishes,
      total: dishes.length,
    })
  } catch (error) {
    console.error('Error fetching dishes:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve dishes from the database.',
    })
  }
})

/**
 * PATCH /dishes/:dishId
 * Atomically updates a dish with version-controlled optimistic concurrency.
 */
dishRouter.patch('/:dishId', async (req: Request, res: Response) => {
  try {
    // 1. Validate route parameter
    const paramResult = dishIdParamSchema.safeParse(req.params)
    if (!paramResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid route parameters.',
        details: paramResult.error.errors.map((e) => e.message),
      })
      return
    }

    const { dishId } = paramResult.data

    // 2. Validate request body with Zod
    const bodyResult = updateDishSchema.safeParse(req.body)
    if (!bodyResult.success) {
      const details = bodyResult.error.errors.map((err) => {
        const path = err.path.join('.') || 'body'
        return `${path}: ${err.message}`
      })
      res.status(400).json({
        error: 'Bad Request',
        message: 'Request body validation failed.',
        details,
      })
      return
    }

    // 3. Delegate to service for atomic concurrency check and update
    const result = await updateDishSafely(dishId, bodyResult.data)

    switch (result.status) {
      case 'not_found':
        res.status(404).json({
          error: 'Not Found',
          message: result.message,
        })
        return

      case 'conflict':
        res.status(409).json({
          error: 'Conflict',
          message: result.message,
          currentDish: result.currentDish,
        })
        return

      case 'bad_request':
        res.status(400).json({
          error: 'Bad Request',
          message: result.message,
        })
        return

      case 'success':
        res.status(200).json({
          message: 'Dish updated successfully',
          dish: result.dish,
        })
        return
    }
  } catch (error) {
    console.error('Error updating dish:', error)
    if (error instanceof ZodError) {
      res.status(400).json({
        error: 'Bad Request',
        message: error.message,
      })
      return
    }
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred while updating the dish.',
    })
  }
})
