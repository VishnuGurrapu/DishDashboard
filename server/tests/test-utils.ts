import mongoose from 'mongoose'

/**
 * Strict allowlist of authorized test database names.
 * Only databases explicitly listed here may be connected to or dropped by test suites.
 */
export const ALLOWED_TEST_DB_NAMES: ReadonlySet<string> = new Set([
  'nosh_test',
  'nosh_test_isolated_suite',
])

/**
 * Validates that a MongoDB test URI targets an explicitly approved test database
 * and cannot point to production, development, the main 'nosh' database, or any unapproved database.
 * Ensures malformed URIs and missing database names fail safely.
 */
export const validateTestDbUri = (uri: string): string => {
  if (!uri || typeof uri !== 'string' || !uri.trim()) {
    throw new Error('Unsafe MONGODB_TEST_URI: URI must be a non-empty string.')
  }

  const trimmedUri = uri.trim()

  if (!trimmedUri.startsWith('mongodb://') && !trimmedUri.startsWith('mongodb+srv://')) {
    throw new Error(
      `Unsafe MONGODB_TEST_URI: Malformed MongoDB URI '${trimmedUri}'. Must begin with 'mongodb://' or 'mongodb+srv://'.`
    )
  }

  let dbName = ''
  try {
    const url = new URL(trimmedUri.replace(/^mongodb(\+srv)?:\/\//, 'http://'))
    if (!url.hostname) {
      throw new Error('Missing host')
    }
    dbName = url.pathname.replace(/^\//, '').split('/')[0]?.split('?')[0]?.trim() || ''
  } catch {
    throw new Error(`Unsafe MONGODB_TEST_URI: Malformed MongoDB URI '${trimmedUri}'.`)
  }

  if (!dbName) {
    throw new Error(`Unsafe MONGODB_TEST_URI: Missing database name in URI '${trimmedUri}'.`)
  }

  const normalized = dbName.toLowerCase()
  if (!ALLOWED_TEST_DB_NAMES.has(normalized)) {
    throw new Error(
      `Unsafe MONGODB_TEST_URI rejected: Database '${dbName}' is not an approved test database. Approved test databases: ${Array.from(ALLOWED_TEST_DB_NAMES).join(', ')}.`
    )
  }

  return dbName
}

/**
 * Safely connects to an isolated MongoDB test database.
 * Throws immediately if the URI or target DB is not strictly on the allowlist.
 */
export const connectTestDatabase = async (uri: string): Promise<typeof mongoose> => {
  validateTestDbUri(uri)
  const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 })
  const activeDbName = (conn.connection.name || '').toLowerCase()

  if (!ALLOWED_TEST_DB_NAMES.has(activeDbName)) {
    await conn.disconnect()
    throw new Error(
      `Unsafe test connection rejected: Connected database '${conn.connection.name}' is not an approved test database. Aborted immediately.`
    )
  }

  return conn
}

/**
 * Safely drops the test database during cleanup.
 * Guarantees that only strictly approved test databases can ever be dropped.
 */
export const safeDropTestDatabase = async (conn: typeof mongoose): Promise<void> => {
  const dbName = (conn.connection?.name || '').toLowerCase()

  if (!dbName || !ALLOWED_TEST_DB_NAMES.has(dbName)) {
    throw new Error(
      `Unsafe test cleanup rejected: Refusing to drop database '${conn.connection?.name || '<unnamed>'}'. Only approved test databases (${Array.from(ALLOWED_TEST_DB_NAMES).join(', ')}) may be dropped.`
    )
  }

  await conn.connection.dropDatabase()
}

