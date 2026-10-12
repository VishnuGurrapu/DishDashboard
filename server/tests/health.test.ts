import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app'

describe('GET /health', () => {
  it('should return 200 with status ok and message', async () => {
    const app = createApp()
    const response = await request(app).get('/health')

    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty('status', 'ok')
    expect(response.body).toHaveProperty('message', 'Nosh Dish Dashboard API is healthy')
    expect(response.body).toHaveProperty('timestamp')
  })
})
