const { initDb, getDb } = require('../src/db');
const { hashPassword } = require('../src/auth');

const DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD || 'Tru@PCI2026';

const seedUsers = [
  {
    username: 'yasser',
    display_name: 'Yasser Shishiny',
    role: 'admin',
    email: 'yasser@tru-pci.local',
    assigned_requirements: null
  },
  {
    username: 'amr',
    display_name: 'Amr Abdelnasr',
    role: 'tru_team',
    email: 'amr@tru-pci.local',
    assigned_requirements: '1,2,4,5'
  },
  {
    username: 'tamer',
    display_name: 'Tamer Sherif',
    role: 'tru_team',
    email: 'tamer@tru-pci.local',
    assigned_requirements: '3,6,8'
  },
  {
    username: 'ahmad',
    display_name: 'Ahmad Sayed',
    role: 'tru_team',
    email: 'ahmad@tru-pci.local',
    assigned_requirements: '9,10,11'
  },
  {
    username: 'iexpert_pm',
    display_name: 'iExpert PM',
    role: 'iexpert_pm',
    email: 'pm@iexpert.local',
    assigned_requirements: null
  },
  {
    username: 'iexpert_grc',
    display_name: 'iExpert GRC Team',
    role: 'iexpert_grc',
    email: 'grc@iexpert.local',
    assigned_requirements: null
  },
  {
    username: 'assessor',
    display_name: 'PCI QSA Assessor',
    role: 'assessor',
    email: 'assessor@pci-dss.local',
    assigned_requirements: null
  }
];

async function seedDatabase() {
  try {
    console.log('Initializing database...');
    initDb();
    const db = getDb();

    console.log('Hashing default password...');
    const passwordHash = await hashPassword(DEFAULT_PASSWORD);

    console.log('Seeding users...');
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO users (username, password_hash, display_name, role, email, assigned_requirements, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);

    let inserted = 0;
    for (const user of seedUsers) {
      const result = stmt.run(
        user.username,
        passwordHash,
        user.display_name,
        user.role,
        user.email,
        user.assigned_requirements
      );

      if (result.changes > 0) {
        console.log(`  Created user: ${user.username} (${user.display_name})`);
        inserted++;
      } else {
        console.log(`  Skipped user: ${user.username} (already exists)`);
      }
    }

    console.log(`\nSeeding complete! ${inserted} user(s) created.`);
    console.log(`\nDefault password for all users: ${DEFAULT_PASSWORD}`);
    console.log('Please change these passwords on first login in production.');

    // List created users
    const users = db.prepare('SELECT username, display_name, role FROM users ORDER BY created_at').all();
    console.log('\nUsers in database:');
    users.forEach(u => {
      console.log(`  - ${u.username} (${u.display_name}) [${u.role}]`);
    });

  } catch (err) {
    console.error('Error seeding database:', err);
    process.exit(1);
  }
}

seedDatabase();
