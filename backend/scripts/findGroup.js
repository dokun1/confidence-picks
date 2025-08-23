import pool from '../src/config/database.js';

async function findGroup() {
  try {
    const result = await pool.query(`
      SELECT id, name, identifier 
      FROM groups 
      WHERE name ILIKE '%okun%' OR identifier ILIKE '%okun%'
    `);
    
    console.log('Groups matching "okun":');
    result.rows.forEach(group => {
      console.log(`ID: ${group.id}, Name: ${group.name}, Identifier: ${group.identifier}`);
    });
    
    // Also check all groups to see what's available
    const allGroups = await pool.query('SELECT id, name, identifier FROM groups ORDER BY id');
    console.log('\nAll groups:');
    allGroups.rows.forEach(group => {
      console.log(`ID: ${group.id}, Name: ${group.name}, Identifier: ${group.identifier}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

findGroup();
