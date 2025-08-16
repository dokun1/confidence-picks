import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

describe('Backend File Structure', () => {
  const backendDir = process.cwd();
  
  test('should have required source files', () => {
    const requiredFiles = [
      'src/app.js',
      'src/config/database.js',
      'src/database/schema.sql',
      'src/models/Group.js',
      'src/routes/groups.js',
      'package.json'
    ];
    
    for (const file of requiredFiles) {
      const filePath = path.join(backendDir, file);
      assert.ok(fs.existsSync(filePath), `File ${file} should exist`);
    }
    
    console.log('✅ Required files exist');
  });
  
  test('should have valid package.json', () => {
    const packagePath = path.join(backendDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    assert.ok(packageJson.scripts, 'Should have scripts section');
    assert.ok(packageJson.scripts.test, 'Should have test script');
    assert.ok(packageJson.scripts['test:db'], 'Should have database test script');
    assert.ok(packageJson.scripts['test:server'], 'Should have server test script');
    assert.ok(packageJson.scripts['test:routes'], 'Should have routes test script');
    
    console.log('✅ Package.json test scripts are configured');
  });
  
  test('should have test files', () => {
    const testFiles = [
      'tests/db-init.test.js',
      'tests/server.test.js',
      'tests/routes.test.js'
    ];
    
    for (const file of testFiles) {
      const filePath = path.join(backendDir, file);
      assert.ok(fs.existsSync(filePath), `Test file ${file} should exist`);
    }
    
    console.log('✅ Test files exist');
  });

  test('should have Docker and environment configuration', () => {
    const configFiles = [
      'docker-compose.test.yml',
      '.env.test',
      '.copilot-instructions.md'
    ];
    
    for (const file of configFiles) {
      const filePath = path.join(backendDir, file);
      assert.ok(fs.existsSync(filePath), `Config file ${file} should exist`);
    }
    
    console.log('✅ Configuration files exist');
  });
});
