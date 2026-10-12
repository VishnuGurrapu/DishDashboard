import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import mongoose from 'mongoose'
import { createApp } from '../src/app'
import { Dish } from '../src/models/dish.model'
import {
  connectTestDatabase,
  safeDropTestDatabase,
  validateTestDbUri,
} from './test-utils'

const TEST_DB_URI =
  process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/nosh_test_isolated_suite'

describe('Database Safety & Cleanup Protections', () => {
  it('rejects unsafe test URIs pointing to main nosh or non-test databases', () => {
    expect(() => validateTestDbUri('mongodb://127.0.0.1:27017/nosh')).toThrowError(
      /Unsafe MONGODB_TEST_URI rejected/i
    )
    expect(() => validateTestDbUri('mongodb://127.0.0.1:27017/production_db')).toThrowError(
      /Unsafe MONGODB_TEST_URI rejected/i
    )
    expect(() => validateTestDbUri('mongodb://127.0.0.1:27017/')).toThrowError(
      /Missing database name/i
    )
  })

  it('accepts valid isolated test URIs containing "test"', () => {
    const dbName = validateTestDbUri('mongodb://127.0.0.1:27017/nosh_test_isolated_suite')
    expect(dbName).toBe('nosh_test_isolated_suite')
  })

  it('safeDropTestDatabase refuses to drop non-test or main database', async () => {
    const fakeConn = {
      connection: {
        name: 'nosh',
        dropDatabase: async () => {},
      },
    } as unknown as typeof mongoose

    await expect(safeDropTestDatabase(fakeConn)).rejects.toThrowError(
      /Unsafe test cleanup rejected/i
    )
  })
})

describe('Dishes API (/dishes)', () => {
  const app = createApp()

  beforeAll(async () => {
    // Fails the test suite immediately if connection fails, instead of silently bypassing assertions
    await connectTestDatabase(TEST_DB_URI)
  })

  afterAll(async () => {
    try {
      await safeDropTestDatabase(mongoose)
    } finally {
      await mongoose.disconnect()
    }
  })

  beforeEach(async () => {
    // Reset test collection in the isolated test DB
    await Dish.deleteMany({})

    // Seed test dishes
    await Dish.insertMany([
      {
        dishId: '101',
        dishName: 'Paneer Butter Masala',
        imageUrl: 'https://example.com/paneer.jpg',
        isPublished: true,
        version: 1,
      },
      {
        dishId: '102',
        dishName: 'Garlic Naan',
        imageUrl: 'https://example.com/naan.jpg',
        isPublished: false,
        version: 1,
      },
    ])
  })

  describe('GET /dishes', () => {
    it('returns all dishes from MongoDB with required fields', async () => {
      const response = await request(app).get('/dishes')

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('dishes')
      expect(response.body).toHaveProperty('total', 2)
      expect(Array.isArray(response.body.dishes)).toBe(true)

      const dish = response.body.dishes.find(
        (d: { dishId: string }) => d.dishId === '101'
      )
      expect(dish).toBeDefined()
      expect(dish.dishId).toBe('101')
      expect(dish.dishName).toBe('Paneer Butter Masala')
      expect(dish.imageUrl).toBe('https://example.com/paneer.jpg')
      expect(dish.isPublished).toBe(true)
      expect(dish.version).toBe(1)
    })
  })

  describe('PATCH /dishes/:dishId - Successful Updates & Version Increment', () => {
    it('updates dishName and increments version from 1 to 2', async () => {
      const response = await request(app)
        .patch('/dishes/101')
        .send({
          dishName: 'Paneer Tikka Masala',
          expectedVersion: 1,
        })

      expect(response.status).toBe(200)
      expect(response.body.message).toBe('Dish updated successfully')
      expect(response.body.dish.dishName).toBe('Paneer Tikka Masala')
      expect(response.body.dish.version).toBe(2)

      // Verify in MongoDB
      const inDb = await Dish.findOne({ dishId: '101' })
      expect(inDb?.dishName).toBe('Paneer Tikka Masala')
      expect(inDb?.version).toBe(2)
      // Publication status was not touched
      expect(inDb?.isPublished).toBe(true)
    })

    it('updates isPublished explicitly when provided', async () => {
      const response = await request(app)
        .patch('/dishes/102')
        .send({
          isPublished: true,
          expectedVersion: 1,
        })

      expect(response.status).toBe(200)
      expect(response.body.dish.isPublished).toBe(true)
      expect(response.body.dish.version).toBe(2)

      const inDb = await Dish.findOne({ dishId: '102' })
      expect(inDb?.isPublished).toBe(true)
      expect(inDb?.version).toBe(2)
    })

    it('updates both dishName and isPublished together', async () => {
      const response = await request(app)
        .patch('/dishes/102')
        .send({
          dishName: 'Stuffed Garlic Naan',
          isPublished: true,
          expectedVersion: 1,
        })

      expect(response.status).toBe(200)
      expect(response.body.dish.dishName).toBe('Stuffed Garlic Naan')
      expect(response.body.dish.isPublished).toBe(true)
      expect(response.body.dish.version).toBe(2)
    })
  })

  describe('PATCH /dishes/:dishId - Concurrency & Conflicts', () => {
    it('returns 409 Conflict with current dish when expectedVersion is stale', async () => {
      // First update increments version to 2
      await request(app)
        .patch('/dishes/101')
        .send({
          dishName: 'Updated Name 1',
          expectedVersion: 1,
        })

      // Second update still uses stale version 1
      const staleResponse = await request(app)
        .patch('/dishes/101')
        .send({
          dishName: 'Stale Attempt',
          expectedVersion: 1,
        })

      expect(staleResponse.status).toBe(409)
      expect(staleResponse.body.error).toBe('Conflict')
      expect(staleResponse.body.currentDish).toBeDefined()
      expect(staleResponse.body.currentDish.dishId).toBe('101')
      expect(staleResponse.body.currentDish.dishName).toBe('Updated Name 1')
      expect(staleResponse.body.currentDish.version).toBe(2)

      // Verify the stale attempt did not alter the database
      const inDb = await Dish.findOne({ dishId: '101' })
      expect(inDb?.dishName).toBe('Updated Name 1')
      expect(inDb?.version).toBe(2)
    })

    it('ensures concurrent requests using the same expectedVersion cannot both succeed', async () => {
      // Fire two concurrent requests with identical expectedVersion
      const request1 = request(app)
        .patch('/dishes/101')
        .send({ dishName: 'Concurrent Candidate A', expectedVersion: 1 })

      const request2 = request(app)
        .patch('/dishes/101')
        .send({ dishName: 'Concurrent Candidate B', expectedVersion: 1 })

      const [res1, res2] = await Promise.all([request1, request2])

      const statuses = [res1.status, res2.status].sort()
      // Exactly one succeeds with 200, the other gets 409 Conflict
      expect(statuses).toEqual([200, 409])

      // Database version must be incremented exactly once to 2
      const inDb = await Dish.findOne({ dishId: '101' })
      expect(inDb?.version).toBe(2)
    })
  })

  describe('PATCH /dishes/:dishId - Validation Errors & Publishing Safeguards', () => {
    it('rejects empty dishName with 400 Bad Request', async () => {
      const response = await request(app)
        .patch('/dishes/101')
        .send({
          dishName: '',
          expectedVersion: 1,
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Bad Request')
    })

    it('rejects whitespace-only dishName with 400 Bad Request', async () => {
      const response = await request(app)
        .patch('/dishes/101')
        .send({
          dishName: '    ',
          expectedVersion: 1,
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Bad Request')
    })

    it('rejects non-string dishName with 400 Bad Request', async () => {
      const response = await request(app)
        .patch('/dishes/101')
        .send({
          dishName: 12345,
          expectedVersion: 1,
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Bad Request')
    })

    it('rejects missing expectedVersion with 400 Bad Request', async () => {
      const response = await request(app)
        .patch('/dishes/101')
        .send({
          dishName: 'Valid Name',
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Bad Request')
    })

    it('rejects invalid expectedVersion values (string, negative, float)', async () => {
      const resString = await request(app)
        .patch('/dishes/101')
        .send({ dishName: 'Valid Name', expectedVersion: '1' })
      expect(resString.status).toBe(400)

      const resNegative = await request(app)
        .patch('/dishes/101')
        .send({ dishName: 'Valid Name', expectedVersion: -1 })
      expect(resNegative.status).toBe(400)

      const resFloat = await request(app)
        .patch('/dishes/101')
        .send({ dishName: 'Valid Name', expectedVersion: 1.5 })
      expect(resFloat.status).toBe(400)
    })

    it('rejects non-boolean isPublished with 400 Bad Request', async () => {
      const response = await request(app)
        .patch('/dishes/101')
        .send({
          isPublished: 'true',
          expectedVersion: 1,
        })

      expect(response.status).toBe(400)
    })

    it('rejects invalid image URL protocols with 400 Bad Request', async () => {
      const response = await request(app)
        .patch('/dishes/101')
        .send({
          imageUrl: 'ftp://example.com/pic.jpg',
          expectedVersion: 1,
        })

      expect(response.status).toBe(400)
    })

    it('rejects request with no update fields provided with 400 Bad Request', async () => {
      const response = await request(app)
        .patch('/dishes/101')
        .send({
          expectedVersion: 1,
        })

      expect(response.status).toBe(400)
    })

    it('rejects publishing when existing dish in DB has malformed URL', async () => {
      // Create a test dish with malformed URL in DB
      await Dish.create({
        dishId: 'broken-img-1',
        dishName: 'Malformed URL Dish',
        imageUrl: 'https://',
        isPublished: false,
        version: 1,
      })

      const response = await request(app)
        .patch('/dishes/broken-img-1')
        .send({
          isPublished: true,
          expectedVersion: 1,
        })

      expect(response.status).toBe(400)
      expect(response.body.message).toMatch(/valid HTTP or HTTPS/i)
    })

    it('rejects publishing when existing dish in DB has non-HTTP protocol URL', async () => {
      await Dish.create({
        dishId: 'ftp-img',
        dishName: 'FTP URL Dish',
        imageUrl: 'ftp://files.example.com/pic.jpg',
        isPublished: false,
        version: 1,
      })

      const response = await request(app)
        .patch('/dishes/ftp-img')
        .send({
          isPublished: true,
          expectedVersion: 1,
        })

      expect(response.status).toBe(400)
      expect(response.body.message).toMatch(/valid HTTP or HTTPS/i)
    })

    it('allows publishing when existing dish has a valid HTTP/HTTPS URL', async () => {
      // Dish 102 was inserted with valid URL 'https://example.com/naan.jpg' and isPublished: false
      const response = await request(app)
        .patch('/dishes/102')
        .send({
          isPublished: true,
          expectedVersion: 1,
        })

      expect(response.status).toBe(200)
      expect(response.body.dish.isPublished).toBe(true)
      expect(response.body.dish.version).toBe(2)
    })
  })

  describe('PATCH /dishes/:dishId - Unknown Dish ID', () => {
    it('returns 404 Not Found when updating non-existent dish', async () => {
      const response = await request(app)
        .patch('/dishes/non-existent-999')
        .send({
          dishName: 'New Dish',
          expectedVersion: 1,
        })

      expect(response.status).toBe(404)
      expect(response.body.error).toBe('Not Found')
    })
  })
})
