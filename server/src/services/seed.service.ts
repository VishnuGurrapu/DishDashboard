import fs from 'fs'
import path from 'path'
import { ZodError } from 'zod'
import { Dish } from '../models/dish.model'
import { dishSeedArraySchema, DishSeedItem } from '../schemas/dish.schema'

export interface SeedResult {
  totalInFile: number
  insertedCount: number
  skippedCount: number
  insertedDishIds: string[]
  skippedDishIds: string[]
}

/**
 * Validates raw data array using Zod schema.
 * Formats errors clearly with item index and field path.
 */
export const validateSeedData = (rawData: unknown): DishSeedItem[] => {
  try {
    return dishSeedArraySchema.parse(rawData)
  } catch (error) {
    if (error instanceof ZodError) {
      const formattedErrors = error.errors.map((err) => {
        const fieldPath = err.path.join('.') || 'root'
        return `  - [${fieldPath}]: ${err.message}`
      })
      throw new Error(`Seed validation failed:\n${formattedErrors.join('\n')}`)
    }
    throw error
  }
}

/**
 * Reads and parses the seed JSON file from disk.
 */
export const readSeedFile = (filePath: string): unknown => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Seed file not found at: ${filePath}`)
  }

  let content: string
  try {
    content = fs.readFileSync(filePath, 'utf-8')
  } catch (err) {
    throw new Error(
      `Failed to read seed file at ${filePath}: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  try {
    return JSON.parse(content)
  } catch (err) {
    throw new Error(
      `Invalid JSON in seed file (${filePath}): ${err instanceof Error ? err.message : String(err)}`
    )
  }
}

/**
 * Idempotently seeds dishes into MongoDB:
 * - Inserts missing dishes with version 1
 * - Skips already existing dishes without overwriting their fields or resetting versions
 */
export const seedDishes = async (
  filePathOrData?: string | unknown[]
): Promise<SeedResult> => {
  let rawData: unknown

  if (typeof filePathOrData === 'string' || !filePathOrData) {
    const targetPath =
      typeof filePathOrData === 'string'
        ? filePathOrData
        : path.resolve(__dirname, '../../../dish-assignment.json')
    rawData = readSeedFile(targetPath)
  } else {
    rawData = filePathOrData
  }

  // Validate JSON schema
  const validatedDishes = validateSeedData(rawData)

  // Find all existing dish IDs in MongoDB
  const incomingIds = validatedDishes.map((d) => d.dishId)
  const existingDocs = await Dish.find(
    { dishId: { $in: incomingIds } },
    { dishId: 1, version: 1 }
  ).lean()

  const existingIdSet = new Set(existingDocs.map((doc) => doc.dishId))

  // Filter missing dishes to insert
  const toInsert = validatedDishes
    .filter((dish) => !existingIdSet.has(dish.dishId))
    .map((dish) => ({
      dishId: dish.dishId,
      dishName: dish.dishName,
      imageUrl: dish.imageUrl,
      isPublished: dish.isPublished,
      version: 1, // Guaranteed default version 1
    }))

  if (toInsert.length > 0) {
    await Dish.insertMany(toInsert)
  }

  return {
    totalInFile: validatedDishes.length,
    insertedCount: toInsert.length,
    skippedCount: existingIdSet.size,
    insertedDishIds: toInsert.map((d) => d.dishId),
    skippedDishIds: Array.from(existingIdSet),
  }
}
