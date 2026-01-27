const Database = require('./database');

async function checkDatabase() {
  const db = new Database();
  await db.init();

  console.log('\n=== AGENT CONFIGS ===');
  const configs = await new Promise((resolve, reject) => {
    db.db.all('SELECT * FROM agent_configs', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });

  if (configs.length === 0) {
    console.log('❌ Aucune configuration d\'agent trouvée en base de données');
  } else {
    console.log(`✅ ${configs.length} configuration(s) trouvée(s):`);
    configs.forEach(config => {
      console.log('\nConfig ID:', config.id);
      console.log('  User ID:', config.user_id);
      console.log('  Page ID:', config.page_id);
      console.log('  Active:', config.is_active === 1 ? 'OUI ✅' : 'NON ❌');
      console.log('  Prompt:', config.prompt ? config.prompt.substring(0, 50) + '...' : 'VIDE');
      console.log('  Tone:', config.tone);
      console.log('  Language:', config.language);
      console.log('  Auto-reply:', config.auto_reply_enabled === 1 ? 'OUI' : 'NON');
      console.log('  Delay:', config.reply_delay_minutes, 'minutes');
    });
  }

  console.log('\n=== USERS ===');
  const users = await new Promise((resolve, reject) => {
    db.db.all('SELECT id, facebook_id, name, email FROM users', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });

  if (users.length === 0) {
    console.log('❌ Aucun utilisateur connecté');
  } else {
    console.log(`✅ ${users.length} utilisateur(s):`);
    users.forEach(user => {
      console.log(`  - ${user.name} (ID: ${user.id}, Facebook ID: ${user.facebook_id})`);
    });
  }

  console.log('\n=== INSTAGRAM ACCOUNTS ===');
  const igAccounts = await new Promise((resolve, reject) => {
    db.db.all('SELECT * FROM instagram_accounts', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });

  if (igAccounts.length === 0) {
    console.log('❌ Aucun compte Instagram connecté');
  } else {
    console.log(`✅ ${igAccounts.length} compte(s) Instagram:`);
    igAccounts.forEach(acc => {
      console.log(`  - @${acc.username} (${acc.name}) - ID: ${acc.instagram_id}`);
    });
  }

  process.exit(0);
}

checkDatabase().catch(err => {
  console.error('Erreur:', err);
  process.exit(1);
});
