// รีเซ็ตหรือตั้ง password ให้ user ผ่าน CLI
// Usage: pnpm tsx --env-file=.env.local scripts/grant-admin.ts <email> <new-password>
import { hash } from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { config } from 'dotenv'
import { db } from '@/db'
import { users } from '@/db/schema/users'

config({ path: '.env.local' })

async function grantAdmin() {
  const email = process.argv[2]
  const password = process.argv[3]

  if (!email || !password) {
    console.error(
      'Usage: pnpm tsx --env-file=.env.local scripts/grant-admin.ts <email> <new-password>',
    )
    process.exit(1)
  }

  const passwordHash = await hash(password, 12)

  const [user] = await db
    .update(users)
    .set({ passwordHash, status: 'active' })
    .where(eq(users.email, email))
    .returning({ email: users.email, role: users.role })

  if (!user) {
    console.error(`❌ ไม่พบ user: ${email}`)
    process.exit(1)
  }

  console.log(`✅ อัปเดต password สำหรับ ${user.email} (${user.role})`)
}

grantAdmin().catch((err) => {
  console.error('❌ Error:', err)
  process.exit(1)
})
