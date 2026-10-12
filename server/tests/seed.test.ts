import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import mongoose from 'mongoose'
import { Dish } from '../src/models/dish.model'
import { validateSeedData, seedDishes } from '../src/services/seed.service'
import { connectTestDatabase, safeDropTestDatabase } from './test-utils'

const TEST_DB_URI =
  process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/nosh_test_isolated_suite'

describe('Seed Validation Logic (Unit)', () => {
  it('validates correct dish seed structure', () => {
    const validData = [
      {
        dishId: '101',
        dishName: 'Masala Dosa',
        imageUrl: 'https://example.com/dosa.jpg',
        isPublished: true,
      },
    ]

    const result = validateSeedData(validData)
    expect(result).toHaveLength(1)
    expect(result[0].dishId).toBe('101')
    expect(result[0].version).toBe(1)
  })

  it('rejects seed data missing required fields', () => {
    const invalidData = [
      {
        dishName: 'Incomplete Dish',
        imageUrl: 'https://example.com/incomplete.jpg',
        // missing dishId and isPublished
      },
    ]

    expect(() => validateSeedData(invalidData)).toThrowError(/Seed validation failed/)
  })

  it('rejects seed data with invalid image URLs', () => {
    const invalidData = [
      {
        dishId: '102',
        dishName: 'Invalid Image Dish',
        imageUrl: 'not-a-valid-url',
        isPublished: false,
      },
    ]

    expect(() => validateSeedData(invalidData)).toThrowError(/imageUrl must be a valid URL/i)
  })

  it('rejects seed data with duplicate dishId entries', () => {
    const duplicateData = [
      {
        dishId: 'same-id',
        dishName: 'Dish A',
        imageUrl: 'https://example.com/a.jpg',
        isPublished: true,
      },
      {
        dishId: 'same-id',
        dishName: 'Dish B',
        imageUrl: 'https://example.com/b.jpg',
        isPublished: false,
      },
    ]

    expect(() => validateSeedData(duplicateData)).toThrowError(/duplicate dishId/)
  })

  it('rejects empty seed array', () => {
    expect(() => validateSeedData([])).toThrowError(/at least one dish/)
  })
})

describe('Seed Database Operation & Idempotency (Safe Test DB)', () => {
  beforeAll(async () => {
    // Connect exclusively to an isolated test database, NEVER the developer's main database
    // Fails fast if connection fails
    await connectTestDatabase(TEST_DB_URI)
    // Clear only the test collection inside nosh_test_isolated_suite
    await Dish.deleteMany({})
  })

  afterAll(async () => {
    try {
      // Safe drop verifying it is strictly an isolated test database
      await safeDropTestDatabase(mongoose)
    } finally {
      await mongoose.disconnect()
    }
  })

  it('inserts missing dishes with default version 1', async () => {
    const sampleDishes = [
      {
        dishId: 'test-1',
        dishName: 'Butter Naan',
        imageUrl: 'https://example.com/naan.jpg',
        isPublished: true,
      },
      {
        dishId: 'test-2',
        dishName: 'Dal Makhani',
        imageUrl: 'https://example.com/dal.jpg',
        isPublished: true,
      },
    ]

    const result = await seedDishes(sampleDishes)
    expect(result.insertedCount).toBe(2)
    expect(result.skippedCount).toBe(0)

    const doc1 = await Dish.findOne({ dishId: 'test-1' })
    expect(doc1).not.toBeNull()
    expect(doc1?.dishName).toBe('Butter Naan')
    expect(doc1?.version).toBe(1)
  })

  it('is strictly idempotent and never overwrites existing edits or resets versions', async () => {
    // Simulate an edit on test-1 made by a user: change name and bump version to 3
    await Dish.updateOne(
      { dishId: 'test-1' },
      { $set: { dishName: 'Garlic Butter Naan', version: 3 } }
    )

    // Run seed again with original data plus one new dish
    const sampleDishesWithNew = [
      {
        dishId: 'test-1',
        dishName: 'Butter Naan', // Original seed name
        imageUrl: 'https://example.com/naan.jpg',
        isPublished: true,
      },
      {
        dishId: 'test-2',
        dishName: 'Dal Makhani',
        imageUrl: 'https://example.com/dal.jpg',
        isPublished: true,
      },
      {
        dishId: 'test-3',
        dishName: 'Paneer Kulcha',
        imageUrl: 'https://example.com/kulcha.jpg',
        isPublished: false,
      },
    ]

    const rerunResult = await seedDishes(sampleDishesWithNew)

    // test-1 and test-2 skipped, only test-3 inserted
    expect(rerunResult.insertedCount).toBe(1)
    expect(rerunResult.skippedCount).toBe(2)
    expect(rerunResult.insertedDishIds).toEqual(['test-3'])

    // Verify test-1 preserved its custom edit and version 3
    const preservedDoc = await Dish.findOne({ dishId: 'test-1' })
    expect(preservedDoc?.dishName).toBe('Garlic Butter Naan')
    expect(preservedDoc?.version).toBe(3)

    // Verify test-3 was created with version 1
    const newDoc = await Dish.findOne({ dishId: 'test-3' })
    expect(newDoc?.version).toBe(1)
  })
})
