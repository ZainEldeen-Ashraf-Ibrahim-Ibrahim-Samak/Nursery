import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'

export async function seedDatabase(db: Database.Database): Promise<void> {
  // Check if users already exist
  const userCountRow = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }
  
  if (userCountRow.count === 0) {
    console.log('No users found. Seeding default admin user...')
    
    // Hash default password 'admin123'
    const hashedPassword = await bcrypt.hash('admin123', 10)
    
    db.prepare(`
      INSERT INTO users (username, password, role, name, is_active)
      VALUES (?, ?, ?, ?, ?)
    `).run('admin', hashedPassword, 'admin', 'Administrator', 1)
  }

  // Seed default settings if they don't exist
  const settingsCountRow = db.prepare('SELECT COUNT(*) as count FROM settings').get() as { count: number }
  
  if (settingsCountRow.count === 0) {
    console.log('No settings found. Seeding default configuration...')
    
    const defaultSettings: { key: string; value: string }[] = [
      // Pricing settings (EGP)
      { key: 'nursery_monthly', value: '2500' },
      { key: 'nursery_daily', value: '150' },
      { key: 'nursery_hourly', value: '30' },
      
      { key: 'hosting_monthly', value: '3000' },
      { key: 'hosting_daily', value: '200' },
      { key: 'hosting_hourly', value: '40' },
      
      { key: 'session_hourly', value: '100' },
      { key: 'session_daily', value: '400' },
      
      // Targets & Capacity
      { key: 'target_profit_pct', value: '0.20' }, // 20%
      { key: 'max_capacity', value: '50' },
      { key: 'work_days', value: '22' },
      { key: 'work_hours', value: '8' },
      
      // Branding Settings
      { key: 'brand_app_name', value: 'أكاديمية زين الدين' }, // Zain Eldeen Academy
      { key: 'brand_org_name', value: 'مركز زين الدين للتوحد ونمو الطفل' },
      { key: 'brand_tagline', value: 'رعاية متميزة وتنمية مهارات طفلك' },
      { key: 'brand_primary_color', value: '#0f766e' }, // Teal 700
      { key: 'brand_accent_color', value: '#f59e0b' },  // Amber 500
      { key: 'brand_phone', value: '+20 123 456 7890' },
      { key: 'brand_address', value: 'القاهرة، مصر' },
      { key: 'brand_email', value: 'info@zaineldeen.com' },
      { key: 'brand_show_logo_sidebar', value: '1' },
      { key: 'brand_show_logo_login', value: '1' },
      { key: 'brand_show_logo_export', value: '1' },
      { key: 'brand_logo_path', value: '' },
      { key: 'brand_icon_path', value: '' },
    ]
    
    const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
    
    const transaction = db.transaction(() => {
      for (const setting of defaultSettings) {
        insertSetting.run(setting.key, setting.value)
      }
    })
    
    transaction()
  }
}
