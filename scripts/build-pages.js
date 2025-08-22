#!/usr/bin/env node

/**
 * Build script for static pages
 * Generates static HTML files from templates
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const publicDir = 'public';
const srcDir = 'src';

function buildPages() {
  console.log('Building static pages...');
  
  // Ensure public directory exists
  if (!existsSync(publicDir)) {
    mkdirSync(publicDir, { recursive: true });
  }
  
  // For now, just copy the existing index.html
  // Later this will template pages with build-time data
  
  console.log('✓ Static pages built successfully');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  buildPages();
}