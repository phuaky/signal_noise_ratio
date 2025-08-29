#!/usr/bin/env node

/**
 * Build script for Signal/Noise Ratio Chrome Extension
 * Creates production-ready manifest.json and cleans up development artifacts
 */

import fs from 'fs';
import path from 'path';

const BUILD_DIR = 'dist';
const MANIFEST_PATH = path.join(BUILD_DIR, 'manifest.json');

// Read the source manifest
const sourceManifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));

// Production manifest modifications
const productionManifest = {
  ...sourceManifest,
  // Ensure production content scripts don't include debug files
  content_scripts: sourceManifest.content_scripts.map(script => ({
    ...script,
    js: script.js.filter(file => 
      !file.includes('debug-panel.js') && 
      !file.includes('diagnostic-logger.js')
    )
  }))
};

// Write production manifest
fs.writeFileSync(MANIFEST_PATH, JSON.stringify(productionManifest, null, 2));

console.log('✅ Production manifest.json created');
console.log(`📦 Extension ready in ${BUILD_DIR}/ directory`);
console.log('🚀 Load the dist/ folder as unpacked extension in Chrome');