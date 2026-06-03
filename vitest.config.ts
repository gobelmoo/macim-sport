import path from 'node:path'
import { config as loadEnv } from 'dotenv'
import { defineConfig } from 'vitest/config'

const env: Record<string, string> = {}
loadEnv({ path: '.env.local', processEnv: env })
if (process.env.TEST_DATABASE_URL) {
  env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL
}
if (process.env.DATABASE_URL) {
  env.DATABASE_URL = process.env.DATABASE_URL
}

const testUrl = env.TEST_DATABASE_URL
if (!testUrl) {
  throw new Error(
    'TEST_DATABASE_URL is not set. Tests require a separate Neon branch — ' +
      'add it to .env.local.',
  )
}
if (testUrl === env.DATABASE_URL) {
  throw new Error(
    'TEST_DATABASE_URL must differ from DATABASE_URL — refusing to run the ' +
      'suite against the real database.',
  )
}
env.DATABASE_URL = testUrl

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    env,
    pool: 'forks',
    fileParallelism: false,
    testTimeout: 60_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
