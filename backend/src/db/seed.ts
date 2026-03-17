// src/db/seed.ts
// Run with: npx ts-node src/db/seed.ts

import bcrypt from 'bcryptjs';
import { pool } from './pool';
import dotenv from 'dotenv';
dotenv.config();

async function seed() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Seed admin user
    const email    = 'admin@example.com';
    const password = 'Admin@1234';
    const hash     = await bcrypt.hash(password, 12);

    await client.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role)
       VALUES ($1, $2, 'Super', 'Admin', 'admin')
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
      [email, hash]
    );
    console.log('✅ Admin user seeded:', email);

    // 2. Admin gets ALL permissions
    await client.query(`
      INSERT INTO role_permissions (role, permission_id)
      SELECT 'admin', id FROM permissions
      ON CONFLICT DO NOTHING
    `);
    console.log('✅ Admin role permissions seeded');

    // 3. Manager gets most permissions
    await client.query(`
      INSERT INTO role_permissions (role, permission_id)
      SELECT 'manager', id FROM permissions
      WHERE atom NOT IN ('audit.view', 'permissions.manage', 'settings.manage')
      ON CONFLICT DO NOTHING
    `);
    console.log('✅ Manager role permissions seeded');

    // 4. Agent gets basic access
    await client.query(`
      INSERT INTO role_permissions (role, permission_id)
      SELECT 'agent', id FROM permissions
      WHERE atom IN ('dashboard.view', 'leads.view', 'tasks.view', 'customer_portal.view')
      ON CONFLICT DO NOTHING
    `);
    console.log('✅ Agent role permissions seeded');

    // 5. Customer gets portal only
    await client.query(`
      INSERT INTO role_permissions (role, permission_id)
      SELECT 'customer', id FROM permissions
      WHERE atom = 'customer_portal.view'
      ON CONFLICT DO NOTHING
    `);
    console.log('✅ Customer role permissions seeded');

    await client.query('COMMIT');
    console.log('\n🎉 Seed complete! Login with:');
    console.log('   Email:    ', email);
    console.log('   Password: ', password);

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); });