import path from 'path'
import { connectDatabase, disconnectDatabase } from '../config/db'
import { seedDishes } from '../services/seed.service'

export const runSeed = async (): Promise<void> => {
  console.log('🌱 Starting dish database seed script...')

  try {
    await connectDatabase()

    // Root dish-assignment.json relative to server/src/scripts
    const seedFilePath = path.resolve(__dirname, '../../../dish-assignment.json')
    console.log(`📖 Reading seed source: ${seedFilePath}`)

    const result = await seedDishes(seedFilePath)

    console.log('----------------------------------------------------')
    console.log('✨ Seed operation completed successfully:')
    console.log(`   Total items evaluated: ${result.totalInFile}`)
    console.log(`   Newly inserted dishes:  ${result.insertedCount}`)
    if (result.insertedCount > 0) {
      console.log(`   Inserted IDs:          [${result.insertedDishIds.join(', ')}]`)
    }
    console.log(`   Preserved/skipped:     ${result.skippedCount}`)
    if (result.skippedCount > 0) {
      console.log(`   Preserved IDs:         [${result.skippedDishIds.join(', ')}]`)
    }
    console.log('----------------------------------------------------')
  } catch (error) {
    console.error('❌ Seed script failed:')
    if (error instanceof Error) {
      console.error(error.message)
    } else {
      console.error(error)
    }
    process.exitCode = 1
  } finally {
    await disconnectDatabase()
  }
}

if (require.main === module || process.env.RUN_SEED_DIRECT === 'true') {
  void runSeed()
}
