#!/usr/bin/env node

import chokidar from 'chokidar';
import path from 'path';
import { fileURLToPath } from 'url';
import { generatePlatformTokens } from './generate-platform-tokens.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOKENS_DIR = path.join(__dirname, '../src/designsystem/tokens');

console.log('🔍 Watching design tokens for changes...');
console.log(`📂 Watching: ${TOKENS_DIR}`);

// Watch for changes in token files
const watcher = chokidar.watch(`${TOKENS_DIR}/*.json`, {
  ignored: /^\./, // ignore dotfiles
  persistent: true,
  ignoreInitial: false // Generate tokens on startup
});

let isGenerating = false;

async function handleTokenChange(eventType, filePath) {
  if (isGenerating) return; // Prevent concurrent generation
  
  const fileName = path.basename(filePath);
  console.log(`\n📝 ${eventType}: ${fileName}`);
  
  isGenerating = true;
  
  try {
    await generatePlatformTokens();
  } catch (error) {
    console.error('Error during platform token generation:', error);
  } finally {
    isGenerating = false;
  }
}

watcher
  .on('add', (filePath) => handleTokenChange('Token file added', filePath))
  .on('change', (filePath) => handleTokenChange('Token file changed', filePath))
  .on('unlink', (filePath) => handleTokenChange('Token file deleted', filePath))
  .on('error', (error) => console.error('Watcher error:', error));

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Stopping token watcher...');
  watcher.close();
  process.exit(0);
});

console.log('✅ Token watcher started! Press Ctrl+C to stop.');
