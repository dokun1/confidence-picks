import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

describe('API Routes', () => {
  let serverProcess;
  const baseURL = 'http://localhost:3004'; // Use unique test port
  
  before(async () => {
    console.log('🧪 Starting server for API tests...');
    
    serverProcess = spawn('node', ['src/app.js'], {
      cwd: process.cwd(),
      env: { 
        ...process.env, 
        NODE_ENV: 'test',
        PORT: '3004'
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Wait for server to fully start
    await setTimeout(5000);
    
    // Verify server is actually running
    let attempts = 0;
    while (attempts < 10) {
      try {
        const response = await fetch(`${baseURL}/`);
        if (response.ok) break;
      } catch (error) {
        attempts++;
        await setTimeout(1000);
      }
    }
  });
  
  after(async () => {
    if (serverProcess) {
      console.log('🧹 Cleaning up server process...');
      serverProcess.kill('SIGTERM');
      await setTimeout(1000);
      
      if (!serverProcess.killed) {
        serverProcess.kill('SIGKILL');
      }
    }
  });
  
  test('should respond to health check', async () => {
    try {
      console.log('🧪 Testing health check endpoint...');
      
      const response = await fetch(`${baseURL}/`);
      const data = await response.json();
      
      assert.strictEqual(response.status, 200, 'Health check should return 200');
      assert.strictEqual(data.message, 'Confidence Picks API is running!', 'Should return correct message');
      
      console.log('✅ Health check test passed');
    } catch (error) {
      console.error('❌ Health check failed:', error);
      throw error;
    }
  });
  
  test('should respond to API base route', async () => {
    try {
      console.log('🧪 Testing API base route...');
      
      const response = await fetch(`${baseURL}/api/`);
      
      // API base route might not exist, but should not return 500
      assert.ok(response.status === 404 || response.status === 200, 'API route should be accessible');
      
      console.log('✅ API base route test passed');
    } catch (error) {
      console.error('❌ API base route test failed:', error);
      throw error;
    }
  });
  
  test('should require auth for protected routes', async () => {
    try {
      console.log('🧪 Testing protected routes authentication...');
      
      // Test groups creation (requires auth)
      const response = await fetch(`${baseURL}/api/groups/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Test Group',
          identifier: 'test-group'
        })
      });
      
      const data = await response.json();
      
      assert.strictEqual(response.status, 401, 'Should require authentication');
      assert.strictEqual(data.error, 'Access token required', 'Should return auth error');
      
      console.log('✅ Protected routes test passed');
    } catch (error) {
      console.error('❌ Protected routes test failed:', error);
      throw error;
    }
  });
  
  test('should handle groups routes', async () => {
    try {
      console.log('🧪 Testing groups routes...');
      
      // Test public group access
      const response = await fetch(`${baseURL}/api/groups/nonexistent`);
      const data = await response.json();
      
      assert.strictEqual(response.status, 404, 'Should return 404 for nonexistent group');
      assert.strictEqual(data.error, 'Group not found', 'Should return correct error message');
      
      console.log('✅ Groups routes test passed');
    } catch (error) {
      console.error('❌ Groups routes test failed:', error);
      throw error;
    }
  });

  test('should handle auth routes', async () => {
    try {
      console.log('🧪 Testing auth routes...');
      
      // Test auth status without token
      const response = await fetch(`${baseURL}/auth/me`);
      const data = await response.json();
      
      assert.strictEqual(response.status, 401, 'Should require authentication');
      assert.strictEqual(data.error, 'Access token required', 'Should return auth error');
      
      console.log('✅ Auth routes test passed');
    } catch (error) {
      console.error('❌ Auth routes test failed:', error);
      throw error;
    }
  });

  test('should handle games API routes', async () => {
    try {
      console.log('🧪 Testing games API routes...');
      
      // Test games endpoint (might require specific parameters)
      const response = await fetch(`${baseURL}/api/games/2024/2/1`);
      
      // Should not return 500, even if no data
      assert.ok(response.status !== 500, 'Games API should not return server error');
      
      console.log('✅ Games API routes test passed');
    } catch (error) {
      console.error('❌ Games API routes test failed:', error);
      throw error;
    }
  });
});
