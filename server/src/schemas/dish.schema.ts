import { z } from 'zod'

export const dishSeedItemSchema = z.object({
  dishId: z
    .string({ required_error: 'dishId is required' })
    .min(1, 'dishId cannot be empty'),
  dishName: z
    .string({ required_error: 'dishName is required' })
    .min(1, 'dishName cannot be empty'),
  imageUrl: z
    .string({ required_error: 'imageUrl is required' })
    .url('imageUrl must be a valid URL'),
  isPublished: z.boolean({ required_error: 'isPublished is required' }),
  version: z.number().int().min(1).optional().default(1),
})

export const dishSeedArraySchema = z
  .array(dishSeedItemSchema)
  .min(1, 'Seed data array must contain at least one dish')
  .refine(
    (dishes) => {
      const ids = dishes.map((d) => d.dishId)
      return new Set(ids).size === ids.length
    },
    {
      message: 'Seed data contains duplicate dishId entries',
    }
  )

export type DishSeedItem = z.infer<typeof dishSeedItemSchema>
