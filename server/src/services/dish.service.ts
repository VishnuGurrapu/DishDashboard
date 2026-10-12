import { Dish, IDish } from '../models/dish.model'
import { UpdateDishInput } from '../schemas/dish.schema'

export type UpdateDishResult =
  | { status: 'success'; dish: Omit<IDish, 'createdAt' | 'updatedAt'> }
  | { status: 'not_found'; message: string }
  | {
      status: 'conflict'
      message: string
      currentDish: Omit<IDish, 'createdAt' | 'updatedAt'>
    }
  | { status: 'bad_request'; message: string }

/**
 * Validates that a string is a complete, well-formed HTTP or HTTPS URL.
 */
export const isValidHttpUrl = (urlString?: string): boolean => {
  if (!urlString || typeof urlString !== 'string') return false
  const trimmed = urlString.trim()
  if (!trimmed) return false

  try {
    const parsed = new URL(trimmed)
    const validProtocol = parsed.protocol === 'http:' || parsed.protocol === 'https:'
    const hasValidHost = parsed.hostname.length > 0 && !parsed.hostname.includes(' ')
    return validProtocol && hasValidHost
  } catch {
    return false
  }
}

export const getAllDishes = async (): Promise<
  Array<Omit<IDish, 'createdAt' | 'updatedAt'>>
> => {
  return Dish.find(
    {},
    {
      _id: 0,
      dishId: 1,
      dishName: 1,
      imageUrl: 1,
      isPublished: 1,
      version: 1,
    }
  )
    .sort({ dishId: 1 })
    .lean()
}

export const getDishById = async (
  dishId: string
): Promise<Omit<IDish, 'createdAt' | 'updatedAt'> | null> => {
  return Dish.findOne(
    { dishId },
    {
      _id: 0,
      dishId: 1,
      dishName: 1,
      imageUrl: 1,
      isPublished: 1,
      version: 1,
    }
  ).lean()
}

export const updateDishSafely = async (
  dishId: string,
  input: UpdateDishInput
): Promise<UpdateDishResult> => {
  // 1. Verify existence of the dish
  const currentDish = await getDishById(dishId)
  if (!currentDish) {
    return {
      status: 'not_found',
      message: `Dish with ID '${dishId}' was not found.`,
    }
  }

  // 2. Early optimistic concurrency check
  if (input.expectedVersion !== currentDish.version) {
    return {
      status: 'conflict',
      message: `Stale version conflict. Expected version ${input.expectedVersion}, but current version is ${currentDish.version}.`,
      currentDish,
    }
  }

  // 3. Publishing integrity validation
  // When publishing a dish (isPublished: true), require non-empty trimmed name and valid complete HTTP/HTTPS imageUrl,
  // validating the complete effective image URL including when derived from existing database record.
  if (input.isPublished === true) {
    const effectiveName = (input.dishName ?? currentDish.dishName)?.trim()
    const effectiveImageUrl = input.imageUrl ?? currentDish.imageUrl

    if (!effectiveName || effectiveName.length === 0) {
      return {
        status: 'bad_request',
        message: 'Publishing requires a non-empty trimmed dishName.',
      }
    }

    if (!isValidHttpUrl(effectiveImageUrl)) {
      return {
        status: 'bad_request',
        message: 'Publishing requires a valid HTTP or HTTPS imageUrl.',
      }
    }
  }

  // 4. Construct update fields without silently toggling any omitted fields
  const updateFields: Record<string, unknown> = {}
  if (input.dishName !== undefined) {
    updateFields.dishName = input.dishName.trim()
  }
  if (input.imageUrl !== undefined) {
    updateFields.imageUrl = input.imageUrl.trim()
  }
  if (input.isPublished !== undefined) {
    updateFields.isPublished = input.isPublished
  }

  // 5. Execute atomic conditional update with version check and single increment
  const updatedDoc = await Dish.findOneAndUpdate(
    { dishId, version: input.expectedVersion },
    {
      $set: updateFields,
      $inc: { version: 1 },
    },
    {
      new: true,
      runValidators: true,
      projection: {
        _id: 0,
        dishId: 1,
        dishName: 1,
        imageUrl: 1,
        isPublished: 1,
        version: 1,
      },
    }
  ).lean()

  // 6. Handle race condition: another concurrent update won the race
  if (!updatedDoc) {
    const latestDish = await getDishById(dishId)
    if (!latestDish) {
      return {
        status: 'not_found',
        message: `Dish with ID '${dishId}' was not found.`,
      }
    }

    return {
      status: 'conflict',
      message: `Stale version conflict. Expected version ${input.expectedVersion}, but current version is ${latestDish.version}.`,
      currentDish: latestDish,
    }
  }

  return {
    status: 'success',
    dish: updatedDoc,
  }
}
