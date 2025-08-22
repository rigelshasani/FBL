#!/usr/bin/env node

/**
 * Show today's daily password for testing
 */

import { generateDailyPassword } from '../src/auth/gate.js';

// Mock crypto for Node.js environment
if (!globalThis.crypto) {
  const { webcrypto } = await import('crypto');
  globalThis.crypto = webcrypto;
}

async function showPassword() {
  const secret = process.env.SECRET_SEED || 'demo-secret-for-testing-12345';
  
  try {
    const password = await generateDailyPassword(secret);
    const now = new Date();
    const tiranaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Tirane' }));
    
    console.log('🔐 Cemetery of Forgotten Books - Daily Password');
    console.log('===============================================');
    console.log(`Password: ${password}`);
    console.log(`Date: ${tiranaTime.toDateString()}`);
    console.log(`Time: ${tiranaTime.toTimeString()}`);
    console.log(`Timezone: Europe/Tirane`);
    console.log('');
    console.log('Use this password to enter the cemetery at http://localhost:8788');
    console.log('Password resets at midnight Tirane time.');
    
  } catch (error) {
    console.error('Error generating password:', error.message);
  }
}

showPassword();