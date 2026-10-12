import path from 'path'
import dotenv from 'dotenv'

// Load from current working directory
dotenv.config()
// Fallback to server/.env relative to this file
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

export const config = {
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nosh',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
}
