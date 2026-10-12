import mongoose from 'mongoose'
import { config } from './env'

export const connectDatabase = async (uri?: string): Promise<typeof mongoose> => {
  const mongoUri = uri || config.mongoUri

  if (!mongoUri) {
    throw new Error('MongoDB connection failed: MONGODB_URI is not defined.')
  }

  try {
    const conn = await mongoose.connect(mongoUri)
    const host = conn.connection.host || 'unknown-host'
    const dbName = conn.connection.name || 'unknown-db'
    console.log(`✅ MongoDB connected successfully: ${host}/${dbName}`)
    return conn
  } catch (error) {
    console.error('❌ MongoDB connection failed:')
    if (error instanceof Error) {
      console.error(`   Error message: ${error.message}`)
    } else {
      console.error('   Unknown error occurred while connecting to MongoDB')
    }
    throw error
  }
}

export const disconnectDatabase = async (): Promise<void> => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect()
    console.log('🔌 Disconnected from MongoDB')
  }
}
