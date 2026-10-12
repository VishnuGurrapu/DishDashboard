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

// Schema for PATCH /dishes/:dishId URL params
export const dishIdParamSchema = z.object({
  dishId: z
    .string({ required_error: 'dishId is required' })
    .trim()
    .min(1, 'dishId parameter cannot be empty'),
})

// Schema for PATCH /dishes/:dishId Request Body
export const updateDishSchema = z
  .object({
    expectedVersion: z
      .number({
        required_error: 'expectedVersion is required',
        invalid_type_error: 'expectedVersion must be a number',
      })
      .int('expectedVersion must be an integer')
      .min(1, 'expectedVersion must be at least 1'),
    dishName: z
      .string({
        invalid_type_error: 'dishName must be a string',
      })
      .trim()
      .min(1, 'dishName cannot be empty or whitespace-only')
      .optional(),
    imageUrl: z
      .string({
        invalid_type_error: 'imageUrl must be a string',
      })
      .trim()
      .url('imageUrl must be a valid URL')
      .refine(
        (url) => /^https?:\/\//i.test(url),
        'imageUrl must use http or https protocol'
      )
      .optional(),
    isPublished: z
      .boolean({
        invalid_type_error: 'isPublished must be a boolean',
      })
      .optional(),
  })
  .strict({
    message: 'Unexpected field in request body',
  })
  .refine(
    (data) =>
      data.dishName !== undefined ||
      data.imageUrl !== undefined ||
      data.isPublished !== undefined,
    {
      message:
        'At least one field to update (dishName, imageUrl, or isPublished) must be provided',
    }
  )

export type UpdateDishInput = z.infer<typeof updateDishSchema>
