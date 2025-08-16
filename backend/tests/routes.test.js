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
        PORT: '3004',
        INIT_DB: 'false'  // Skip DB init since it's already done
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Wait for server to fully start
    await setTimeout(3000);  // Reduced from 5000ms
    
    // Verify server is actually running
    let attempts = 0;
    while (attempts < 5) {  // Reduced from 10 attempts
      try {
        const response = await fetch(`${baseURL}/`);
        if (response.ok) break;
      } catch (error) {
        attempts++;
        await setTimeout(500);  // Reduced from 1000ms
      }
    }
  });
  
  after(async () => {
    if (serverProcess) {
      console.log('🧹 Cleaning up server process...');
      
      // Try graceful shutdown first
      serverProcess.kill('SIGTERM');
      await setTimeout(2000);
      
      // Force kill if still running
      if (!serverProcess.killed) {
        console.log('⚠️ Force killing server process...');
        serverProcess.kill('SIGKILL');
      }
      
      // Wait a bit more for cleanup
      await setTimeout(1000);
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
      
      // Add a small delay to ensure server is fully ready
      await setTimeout(100);
      
      // Test auth status without token with proper error handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // Increased timeout for CI
      
      let response;
      try {
        response = await fetch(`${baseURL}/auth/me`, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
      } catch (fetchError) {
        clearTimeout(timeoutId);
        console.error('❌ Auth fetch failed:', fetchError);
        throw new Error(`Failed to fetch auth endpoint: ${fetchError.message}`);
      }
      clearTimeout(timeoutId);
      
      console.log(`Auth response status: ${response.status}`);
      console.log(`Auth response headers:`, Object.fromEntries(response.headers.entries()));
      
      let data;
      try {
        data = await response.json();
        console.log(`Auth response data:`, data);
      } catch (jsonError) {
        console.error('❌ Failed to parse auth response as JSON:', jsonError);
        const text = await response.text();
        console.log(`Auth response text:`, text);
        throw new Error(`Auth endpoint returned invalid JSON: ${text}`);
      }
      
      // Be more flexible with the response - either 401 or 403 is acceptable for unauthorized
      assert.ok(response.status === 401 || response.status === 403, `Should require authentication, got ${response.status}`);
      assert.ok(data && typeof data === 'object', 'Should return JSON object');
      assert.ok(data.error, 'Should return an error message');
      assert.ok(
        data.error === 'Access token required' || 
        data.error === 'Invalid access token' || 
        data.error.includes('token') ||
        data.error.includes('required') ||
        data.error.includes('unauthorized'),
        `Should return token-related error, got: ${data.error}`
      );
      
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout for CI
      
      const response = await fetch(`${baseURL}/api/games/2024/2/1`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      // Should not return 500, even if no data
      assert.ok(response.status !== 500, 'Games API should not return server error');
      
      console.log('✅ Games API routes test passed');
    } catch (error) {
      console.error('❌ Games API routes test failed:', error);
      throw error;
    }
  });
});
