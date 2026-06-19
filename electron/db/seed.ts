import type { Db } from './connection.js'
import bcrypt from 'bcryptjs'
import { getSeedAdmin, seedSetting } from '../env.js'

export async function seedDatabase(db: Db): Promise<void> {
  // Check if users already exist
  const userCountRow = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }

  if (userCountRow.count === 0) {
    // Initial admin credentials come from the environment (first-run only).
    const { username, password } = getSeedAdmin()
    const adminPassword = password || 'admin123'
    if (!password) {
      console.warn(
        '[seed] SEED_ADMIN_PASSWORD not set — seeding default admin password "admin123". ' +
        'Set SEED_ADMIN_PASSWORD in .env and change it after first login.'
      )
    }
    console.log(`No users found. Seeding admin user "${username}"...`)

    const hashedPassword = await bcrypt.hash(adminPassword, 10)

    db.prepare(`
      INSERT INTO users (username, password, role, name, is_active)
      VALUES (?, ?, ?, ?, ?)
    `).run(username, hashedPassword, 'admin', 'Administrator', 1)
  }

  // Seed default settings if they don't exist
  const settingsCountRow = db.prepare('SELECT COUNT(*) as count FROM settings').get() as { count: number }
  
  if (settingsCountRow.count === 0) {
    console.log('No settings found. Seeding default configuration...')
    
    // Non-sensitive defaults; each is overridable via an optional SEED_* env key
    // (first-run only — see specs/002-excel-import-env-config/contracts/env-vars.md).
    const defaultSettings: { key: string; value: string }[] = [
      // Pricing settings (EGP)
      { key: 'nursery_monthly', value: seedSetting('SEED_NURSERY_MONTHLY', '2500') },
      { key: 'nursery_daily', value: seedSetting('SEED_NURSERY_DAILY', '150') },
      { key: 'nursery_hourly', value: seedSetting('SEED_NURSERY_HOURLY', '30') },

      { key: 'hosting_monthly', value: seedSetting('SEED_HOSTING_MONTHLY', '3000') },
      { key: 'hosting_daily', value: seedSetting('SEED_HOSTING_DAILY', '200') },
      { key: 'hosting_hourly', value: seedSetting('SEED_HOSTING_HOURLY', '40') },

      { key: 'session_hourly', value: seedSetting('SEED_SESSION_HOURLY', '100') },
      { key: 'session_daily', value: seedSetting('SEED_SESSION_DAILY', '400') },

      // Targets & Capacity
      { key: 'target_profit_pct', value: seedSetting('SEED_TARGET_PROFIT_PCT', '0.20') }, // 20%
      { key: 'max_capacity', value: seedSetting('SEED_MAX_CAPACITY', '50') },
      { key: 'work_days', value: seedSetting('SEED_WORK_DAYS', '22') },
      { key: 'work_hours', value: seedSetting('SEED_WORK_HOURS', '8') },

      // Branding Settings
      { key: 'brand_app_name', value: seedSetting('SEED_BRAND_APP_NAME', 'أكاديمية زين الدين') },
      { key: 'brand_org_name', value: seedSetting('SEED_BRAND_ORG_NAME', 'مركز زين الدين للتوحد ونمو الطفل') },
      { key: 'brand_tagline', value: 'رعاية متميزة وتنمية مهارات طفلك' },
      { key: 'brand_primary_color', value: seedSetting('SEED_BRAND_PRIMARY_COLOR', '#0f766e') }, // Teal 700
      { key: 'brand_accent_color', value: seedSetting('SEED_BRAND_ACCENT_COLOR', '#f59e0b') },  // Amber 500
      { key: 'brand_phone', value: seedSetting('SEED_BRAND_PHONE', '+20 123 456 7890') },
      { key: 'brand_address', value: 'القاهرة، مصر' },
      { key: 'brand_email', value: seedSetting('SEED_BRAND_EMAIL', 'info@zaineldeen.com') },
      { key: 'brand_show_logo_sidebar', value: '1' },
      { key: 'brand_show_logo_login', value: '1' },
      { key: 'brand_show_logo_export', value: '1' },
      { key: 'brand_logo_path', value: '' },
      { key: 'brand_icon_path', value: '' },
    ]
    
    const insertSetting = db.prepare(`
      INSERT OR IGNORE INTO settings (key, value, updated_at, synced)
      VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), 0)
    `)
    
    const transaction = db.transaction(() => {
      for (const setting of defaultSettings) {
        insertSetting.run(setting.key, setting.value)
      }
    })
    
    transaction()
  }
}
