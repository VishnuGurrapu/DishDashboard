import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import mongoose from 'mongoose'
import express from 'express'
import { createApp, errorHandler } from '../src/app'
import { Dish } from '../src/models/dish.model'
import {
  connectTestDatabase,
  safeDropTestDatabase,
  validateTestDbUri,
} from './test-utils'

const TEST_DB_URI =
  process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/nosh_test_isolated_suite'

describe('Database Safety & Cleanup Protections (Strict Allowlist)', () => {
  it('accepts explicitly approved test database URIs', () => {
    expect(validateTestDbUri('mongodb://127.0.0.1:27017/nosh_test')).toBe('nosh_test')
    expect(
      validateTestDbUri('mongodb://127.0.0.1:27017/nosh_test_isolated_suite')
    ).toBe('nosh_test_isolated_suite')
    expect(
      validateTestDbUri(
        'mongodb+srv://user:pass@cluster.mongodb.net/nosh_test?retryWrites=true'
      )
    ).toBe('nosh_test')
  })

  it('rejects the normal nosh database', () => {
    expect(() => validateTestDbUri('mongodb://127.0.0.1:27017/nosh')).toThrowError(
      /Unsafe MONGODB_TEST_URI rejected: Database 'nosh' is not an approved test database/i
    )
  })

  it('rejects production_test and closes the substring-match loophole', () => {
    expect(() =>
      validateTestDbUri('mongodb://127.0.0.1:27017/production_test')
    ).toThrowError(
      /Unsafe MONGODB_TEST_URI rejected: Database 'production_test' is not an approved test database/i
    )
  })

  it('rejects arbitrary unapproved databases (production, development, staging_test)', () => {
    expect(() =>
      validateTestDbUri('mongodb://127.0.0.1:27017/production')
    ).toThrowError(/Unsafe MONGODB_TEST_URI rejected/i)
    expect(() =>
      validateTestDbUri('mongodb://127.0.0.1:27017/development')
    ).toThrowError(/Unsafe MONGODB_TEST_URI rejected/i)
    expect(() =>
      validateTestDbUri('mongodb://127.0.0.1:27017/staging_test')
    ).toThrowError(/Unsafe MONGODB_TEST_URI rejected/i)
  })

  it('fails safely when database name is missing', () => {
    expect(() => validateTestDbUri('mongodb://127.0.0.1:27017/')).toThrowError(
      /Missing database name in URI/i
    )
    expect(() => validateTestDbUri('mongodb://127.0.0.1:27017')).toThrowError(
      /Missing database name in URI/i
    )
  })

  it('fails safely on malformed URIs', () => {
    expect(() => validateTestDbUri('not-a-valid-uri')).toThrowError(
      /Malformed MongoDB URI/i
    )
    expect(() => validateTestDbUri('http://127.0.0.1:27017/nosh_test')).toThrowError(
      /Must begin with 'mongodb:\/\/'/i
    )
    expect(() => validateTestDbUri('mongodb://')).toThrowError(
      /Malformed MongoDB URI/i
    )
  })

  it('safeDropTestDatabase strictly protects unapproved databases from being dropped', async () => {
    // Rejects dropping normal nosh database
    const noshConn = {
      connection: { name: 'nosh', dropDatabase: async () => {} },
    } as unknown as typeof mongoose
    await expect(safeDropTestDatabase(noshConn)).rejects.toThrowError(
      /Unsafe test cleanup rejected: Refusing to drop database 'nosh'/i
    )

    // Rejects dropping production_test
    const prodTestConn = {
      connection: { name: 'production_test', dropDatabase: async () => {} },
    } as unknown as typeof mongoose
    await expect(safeDropTestDatabase(prodTestConn)).rejects.toThrowError(
      /Unsafe test cleanup rejected: Refusing to drop database 'production_test'/i
    )

    // Rejects dropping arbitrary unapproved database
    const devConn = {
      connection: { name: 'dev_database', dropDatabase: async () => {} },
    } as unknown as typeof mongoose
    await expect(safeDropTestDatabase(devConn)).rejects.toThrowError(
      /Unsafe test cleanup rejected: Refusing to drop database 'dev_database'/i
    )

    // Rejects dropping unnamed database
    const unnamedConn = {
      connection: { name: '', dropDatabase: async () => {} },
    } as unknown as typeof mongoose
    await expect(safeDropTestDatabase(unnamedConn)).rejects.toThrowError(
      /Unsafe test cleanup rejected/i
    )

    // Permits dropping approved test database
    let dropped = false
    const approvedConn = {
      connection: {
        name: 'nosh_test',
        dropDatabase: async () => {
          dropped = true
        },
      },
    } as unknown as typeof mongoose
    await safeDropTestDatabase(approvedConn)
    expect(dropped).toBe(true)
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
          isPublished: true,
          expectedVersion: 1,
        })

      expect(response.status).toBe(200)
      expect(response.body.message).toBe('Dish updated successfully')
      expect(response.body.dish.dishName).toBe('Paneer Tikka Masala')
      expect(response.body.dish.isPublished).toBe(true)
      expect(response.body.dish.version).toBe(2)

      // Verify in MongoDB
      const inDb = await Dish.findOne({ dishId: '101' })
      expect(inDb?.dishName).toBe('Paneer Tikka Masala')
      expect(inDb?.version).toBe(2)
      expect(inDb?.isPublished).toBe(true)
    })

    it('updates isPublished explicitly when provided', async () => {
      const response = await request(app)
        .patch('/dishes/102')
        .send({
          dishName: 'Garlic Naan',
          isPublished: true,
          expectedVersion: 1,
        })

      expect(response.status).toBe(200)
      expect(response.body.dish.dishName).toBe('Garlic Naan')
      expect(response.body.dish.isPublished).toBe(true)
      expect(response.body.dish.version).toBe(2)

      const inDb = await Dish.findOne({ dishId: '102' })
      expect(inDb?.dishName).toBe('Garlic Naan')
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

      const inDb = await Dish.findOne({ dishId: '102' })
      expect(inDb?.dishName).toBe('Stuffed Garlic Naan')
      expect(inDb?.isPublished).toBe(true)
      expect(inDb?.version).toBe(2)
    })
  })

  describe('PATCH /dishes/:dishId - Concurrency & Conflicts', () => {
    it('returns 409 Conflict with current dish when expectedVersion is stale', async () => {
      // First update increments version to 2
      await request(app)
        .patch('/dishes/101')
        .send({
          dishName: 'Updated Name 1',
          isPublished: true,
          expectedVersion: 1,
        })

      // Second update still uses stale version 1
      const staleResponse = await request(app)
        .patch('/dishes/101')
        .send({
          dishName: 'Stale Attempt',
          isPublished: true,
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
        .send({ dishName: 'Concurrent Candidate A', isPublished: true, expectedVersion: 1 })

      const request2 = request(app)
        .patch('/dishes/101')
        .send({ dishName: 'Concurrent Candidate B', isPublished: true, expectedVersion: 1 })

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
          isPublished: true,
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
          isPublished: true,
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
          isPublished: true,
          expectedVersion: 1,
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Bad Request')
    })

    it('rejects missing dishName with 400 Bad Request', async () => {
      const response = await request(app)
        .patch('/dishes/101')
        .send({
          isPublished: true,
          expectedVersion: 1,
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Bad Request')
    })

    it('rejects missing isPublished with 400 Bad Request', async () => {
      const response = await request(app)
        .patch('/dishes/101')
        .send({
          dishName: 'Valid Name',
          expectedVersion: 1,
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Bad Request')
    })

    it('rejects non-boolean isPublished with 400 Bad Request', async () => {
      const response = await request(app)
        .patch('/dishes/101')
        .send({
          dishName: 'Valid Name',
          isPublished: 'true',
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
          isPublished: true,
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Bad Request')
    })

    it('rejects invalid expectedVersion values (string, negative, float)', async () => {
      const resString = await request(app)
        .patch('/dishes/101')
        .send({ dishName: 'Valid Name', isPublished: true, expectedVersion: '1' })
      expect(resString.status).toBe(400)

      const resNegative = await request(app)
        .patch('/dishes/101')
        .send({ dishName: 'Valid Name', isPublished: true, expectedVersion: -1 })
      expect(resNegative.status).toBe(400)

      const resFloat = await request(app)
        .patch('/dishes/101')
        .send({ dishName: 'Valid Name', isPublished: true, expectedVersion: 1.5 })
      expect(resFloat.status).toBe(400)
    })

    it('rejects request containing imageUrl with 400 Bad Request and leaves database record unchanged', async () => {
      const original = await Dish.findOne({ dishId: '101' }).lean()

      const response = await request(app)
        .patch('/dishes/101')
        .send({
          dishName: 'Attempted Image Change',
          isPublished: true,
          imageUrl: 'https://example.com/new-pic.jpg',
          expectedVersion: 1,
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Bad Request')

      // Verify database record remains completely unchanged
      const after = await Dish.findOne({ dishId: '101' }).lean()
      expect(after?.dishName).toBe(original?.dishName)
      expect(after?.imageUrl).toBe(original?.imageUrl)
      expect(after?.isPublished).toBe(original?.isPublished)
      expect(after?.version).toBe(original?.version)
    })

    it('rejects request with only expectedVersion (missing dishName and isPublished) with 400 Bad Request', async () => {
      const response = await request(app)
        .patch('/dishes/101')
        .send({
          expectedVersion: 1,
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Bad Request')
    })

    it('rejects publishing when existing dish in DB has malformed URL and does not mutate database', async () => {
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
          dishName: 'Malformed URL Dish',
          isPublished: true,
          expectedVersion: 1,
        })

      expect(response.status).toBe(400)
      expect(response.body.message).toMatch(/valid HTTP or HTTPS/i)

      const inDb = await Dish.findOne({ dishId: 'broken-img-1' })
      expect(inDb?.isPublished).toBe(false)
      expect(inDb?.version).toBe(1)
    })

    it('rejects publishing when existing dish in DB has non-HTTP protocol URL and does not mutate database', async () => {
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
          dishName: 'FTP URL Dish',
          isPublished: true,
          expectedVersion: 1,
        })

      expect(response.status).toBe(400)
      expect(response.body.message).toMatch(/valid HTTP or HTTPS/i)

      const inDb = await Dish.findOne({ dishId: 'ftp-img' })
      expect(inDb?.isPublished).toBe(false)
      expect(inDb?.version).toBe(1)
    })

    it('allows publishing when existing dish has a valid HTTP/HTTPS URL', async () => {
      // Dish 102 was inserted with valid URL 'https://example.com/naan.jpg' and isPublished: false
      const response = await request(app)
        .patch('/dishes/102')
        .send({
          dishName: 'Garlic Naan',
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
          isPublished: true,
          expectedVersion: 1,
        })

      expect(response.status).toBe(404)
      expect(response.body.error).toBe('Not Found')
    })
  })

  describe('Persistence Across Separate App Instances & Database Immutability', () => {
    it('persists dish updates and incremented version across separate app instances backed by the same MongoDB database', async () => {
      // 1. App instance A performs an update on dish 101 from v1 -> v2
      const appInstanceA = createApp()
      const updateRes = await request(appInstanceA)
        .patch('/dishes/101')
        .send({
          dishName: 'Persistent Paneer Butter Masala',
          isPublished: true,
          expectedVersion: 1,
        })
      expect(updateRes.status).toBe(200)
      expect(updateRes.body.dish.version).toBe(2)

      // 2. Separate Express app instance B querying the same persistent MongoDB database
      const appInstanceB = createApp()
      const getRes = await request(appInstanceB).get('/dishes')
      expect(getRes.status).toBe(200)

      const reloadedDish = getRes.body.dishes.find(
        (d: { dishId: string }) => d.dishId === '101'
      )
      expect(reloadedDish).toBeDefined()
      expect(reloadedDish.dishName).toBe('Persistent Paneer Butter Masala')
      expect(reloadedDish.version).toBe(2)

      // Verify direct MongoDB document
      const doc = await Dish.findOne({ dishId: '101' })
      expect(doc?.dishName).toBe('Persistent Paneer Butter Masala')
      expect(doc?.version).toBe(2)
    })

    it('guarantees invalid requests and 409 conflicts do not mutate the database record', async () => {
      const initialDoc = await Dish.findOne({ dishId: '101' }).lean()
      expect(initialDoc).not.toBeNull()

      // 1. Invalid PATCH request (empty name)
      const badReqRes = await request(app)
        .patch('/dishes/101')
        .send({ dishName: '   ', isPublished: true, expectedVersion: 1 })
      expect(badReqRes.status).toBe(400)

      const docAfterBadReq = await Dish.findOne({ dishId: '101' }).lean()
      expect(docAfterBadReq?.dishName).toBe(initialDoc?.dishName)
      expect(docAfterBadReq?.version).toBe(initialDoc?.version)
      expect(docAfterBadReq?.isPublished).toBe(initialDoc?.isPublished)

      // 2. Conflict PATCH request (stale expectedVersion)
      const conflictRes = await request(app)
        .patch('/dishes/101')
        .send({ dishName: 'Stale Attempt Name', isPublished: true, expectedVersion: 999 })
      expect(conflictRes.status).toBe(409)

      const docAfterConflict = await Dish.findOne({ dishId: '101' }).lean()
      expect(docAfterConflict?.dishName).toBe(initialDoc?.dishName)
      expect(docAfterConflict?.version).toBe(initialDoc?.version)
      expect(docAfterConflict?.isPublished).toBe(initialDoc?.isPublished)
    })
  })

  describe('Global Error Handling & Malformed JSON Middleware', () => {
    it('returns HTTP 400 JSON rather than HTML when request body contains malformed JSON', async () => {
      const response = await request(app)
        .patch('/dishes/101')
        .set('Content-Type', 'application/json')
        .send('{"dishName": "Broken JSON,')

      expect(response.status).toBe(400)
      expect(response.headers['content-type']).toMatch(/application\/json/)
      expect(response.body).toEqual({
        error: 'Bad Request',
        message: 'Invalid JSON body',
      })
    })

    it('returns safe HTTP 500 JSON without exposing internal exception details on unexpected errors', async () => {
      const testApp = express()
      testApp.use(express.json())
      testApp.get('/test-unexpected-error', (_req, _res, next) => {
        next(new Error('Internal database password leak or stack trace'))
      })
      testApp.use(errorHandler)

      const response = await request(testApp).get('/test-unexpected-error')

      expect(response.status).toBe(500)
      expect(response.headers['content-type']).toMatch(/application\/json/)
      expect(response.body).toEqual({
        error: 'Internal Server Error',
        message: 'Unexpected error',
      })
      expect(JSON.stringify(response.body)).not.toContain('password')
      expect(JSON.stringify(response.body)).not.toContain('stack trace')
    })
  })
})

