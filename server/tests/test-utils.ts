import mongoose from 'mongoose'

/**
 * Validates that a MongoDB test URI targets a dedicated test database
 * and cannot accidentally point to the production or developer's main database.
 */
export const validateTestDbUri = (uri: string): string => {
  if (!uri || typeof uri !== 'string') {
    throw new Error('Unsafe MONGODB_TEST_URI: URI must be a non-empty string.')
  }

  // Extract database name from URI: e.g. mongodb://host:port/db_name?opts
  let dbName = ''
  try {
    const url = new URL(uri.replace(/^mongodb(\+srv)?:\/\//, 'http://'))
    dbName = url.pathname.replace(/^\//, '').split('/')[0] || ''
  } catch {
    const match = uri.match(/\/([^/?#]+)(\?|$)/)
    dbName = match ? match[1] : ''
  }

  if (!dbName) {
    throw new Error(`Unsafe MONGODB_TEST_URI: Missing database name in URI '${uri}'.`)
  }

  const normalized = dbName.toLowerCase()
  if (normalized === 'nosh' || !normalized.includes('test')) {
    throw new Error(
      `Unsafe MONGODB_TEST_URI rejected: Database '${dbName}' is not explicitly an isolated test database. Test database name must contain 'test' and cannot be the main 'nosh' database.`
    )
  }

  return dbName
}

/**
 * Safely connects to an isolated MongoDB test database.
 * Throws immediately if the URI or target DB is unsafe.
 */
export const connectTestDatabase = async (uri: string): Promise<typeof mongoose> => {
  validateTestDbUri(uri)
  const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 })
  const activeDbName = (conn.connection.name || '').toLowerCase()

  if (activeDbName === 'nosh' || !activeDbName.includes('test')) {
    await conn.disconnect()
    throw new Error(
      `Unsafe test connection: Connected database '${conn.connection.name}' is not a test database. Aborted immediately.`
    )
  }

  return conn
}

/**
 * Safely drops the test database during cleanup.
 * Guarantees that only databases with 'test' in their name and not 'nosh' can ever be dropped.
 */
export const safeDropTestDatabase = async (conn: typeof mongoose): Promise<void> => {
  const dbName = (conn.connection.name || '').toLowerCase()

  if (!dbName || dbName === 'nosh' || !dbName.includes('test')) {
    throw new Error(
      `Unsafe test cleanup rejected: Refusing to drop database '${conn.connection.name}'. Only test databases containing 'test' (and not 'nosh') may be dropped.`
    )
  }

  await conn.connection.dropDatabase()
}
