import { hash } from 'bcryptjs'
import { db } from '.'
import { sponsors } from './schema/sponsors'
import { users } from './schema/users'

async function seed() {
  console.log('🌱 Seeding database...')

  const ownerEmail = process.env.SEED_OWNER_EMAIL
  const ownerPassword = process.env.SEED_OWNER_PASSWORD
  if (!ownerEmail || !ownerPassword) {
    throw new Error(
      'SEED_OWNER_EMAIL และ SEED_OWNER_PASSWORD ต้องตั้งค่าใน .env.local ก่อน seed',
    )
  }

  // สร้าง MACIM SPORT internal sponsor (is_internal = true)
  const [macimSponsor] = await db
    .insert(sponsors)
    .values({
      sponsorName: 'MACIM SPORT',
      companyRegNumber: '',
      isInternal: true,
      serviceType: 'physical_and_digital',
      contactName: 'MACIM SPORT',
      contactEmail: ownerEmail,
    })
    .onConflictDoNothing()
    .returning()

  console.log('✅ Created MACIM SPORT internal sponsor:', macimSponsor?.sponsorId)

  // สร้าง super_admin_owner account
  const passwordHash = await hash(ownerPassword, 12)
  const [owner] = await db
    .insert(users)
    .values({
      email: ownerEmail,
      passwordHash,
      role: 'super_admin_owner',
    })
    .onConflictDoNothing()
    .returning()

  console.log('✅ Created super_admin_owner:', owner?.email)
  console.log('🎉 Seed complete.')
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
