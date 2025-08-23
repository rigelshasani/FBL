#!/usr/bin/env node

/**
 * Cemetery of Forgotten Books - Admin CLI
 * Manage daily passwords and admin configuration
 */

import { program } from 'commander';
import fs from 'fs';
import path from 'path';

// Default seeds (for development)
const DEFAULT_SECRET_SEED = 'demo-secret-for-testing-12345';
const DEFAULT_ADMIN_SECRET_SEED = 'admin-secret-cfb-67890';

/**
 * Generate password using HMAC-SHA256
 */
async function generatePassword(secretSeed, dateStr, prefix = '', length = 8) {
  const encoder = new TextEncoder();
  const data = prefix ? `${prefix}:${dateStr}` : dateStr;
  
  const key = await crypto.subtle.importKey(
    'raw', 
    encoder.encode(secretSeed),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, length);
}

/**
 * Get passwords for a specific date
 */
async function getPasswordsForDate(date, userSeed = DEFAULT_SECRET_SEED, adminSeed = DEFAULT_ADMIN_SECRET_SEED) {
  const dateStr = date.toISOString().split('T')[0];
  
  const userPassword = await generatePassword(userSeed, dateStr, '', 8);
  const adminPassword = await generatePassword(adminSeed, dateStr, 'admin', 12);
  
  return { dateStr, userPassword, adminPassword };
}

/**
 * Show current passwords
 */
program
  .command('passwords')
  .description('Show today\'s user and admin passwords')
  .option('-d, --date <date>', 'Specific date (YYYY-MM-DD)', new Date().toISOString().split('T')[0])
  .option('-u, --user-seed <seed>', 'User secret seed', DEFAULT_SECRET_SEED)
  .option('-a, --admin-seed <seed>', 'Admin secret seed', DEFAULT_ADMIN_SECRET_SEED)
  .action(async (options) => {
    const date = new Date(options.date + 'T00:00:00.000Z');
    const { dateStr, userPassword, adminPassword } = await getPasswordsForDate(
      date, 
      options.userSeed, 
      options.adminSeed
    );
    
    console.log('');
    console.log('🏚️  Cemetery of Forgotten Books - Daily Passwords');
    console.log('═'.repeat(50));
    console.log(`📅 Date: ${dateStr}`);
    console.log(`👤 User Password (8 chars): ${userPassword}`);
    console.log(`🔐 Admin Password (12 chars): ${adminPassword}`);
    console.log('');
    console.log('🔗 Access URLs:');
    console.log(`   User: http://localhost:8788/lock`);
    console.log(`   Admin: http://localhost:8788/admin`);
    console.log('');
  });

/**
 * Show password schedule for upcoming days
 */
program
  .command('schedule')
  .description('Show password schedule for upcoming days')
  .option('-d, --days <days>', 'Number of days to show', '7')
  .option('-u, --user-seed <seed>', 'User secret seed', DEFAULT_SECRET_SEED)
  .option('-a, --admin-seed <seed>', 'Admin secret seed', DEFAULT_ADMIN_SECRET_SEED)
  .action(async (options) => {
    const days = parseInt(options.days);
    
    console.log('');
    console.log('🏚️  Cemetery of Forgotten Books - Password Schedule');
    console.log('═'.repeat(60));
    
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setUTCDate(date.getUTCDate() + i);
      date.setUTCHours(0, 0, 0, 0);
      
      const { dateStr, userPassword, adminPassword } = await getPasswordsForDate(
        date, 
        options.userSeed, 
        options.adminSeed
      );
      
      const dayLabel = i === 0 ? ' (Today)' : i === 1 ? ' (Tomorrow)' : '';
      console.log(`${dateStr}${dayLabel}: User=${userPassword} Admin=${adminPassword}`);
    }
    console.log('');
  });

/**
 * Generate new secret seeds
 */
program
  .command('generate-seeds')
  .description('Generate new random secret seeds for production')
  .action(() => {
    const generateSeed = () => {
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_';
      let result = '';
      for (let i = 0; i < 32; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };
    
    const userSeed = generateSeed();
    const adminSeed = generateSeed();
    
    console.log('');
    console.log('🔐 Generated Secret Seeds for Production:');
    console.log('═'.repeat(50));
    console.log(`SECRET_SEED=${userSeed}`);
    console.log(`ADMIN_SECRET_SEED=${adminSeed}`);
    console.log('');
    console.log('⚠️  Save these securely and set them via wrangler secrets:');
    console.log(`   wrangler secret put SECRET_SEED`);
    console.log(`   wrangler secret put ADMIN_SECRET_SEED`);
    console.log('');
  });

/**
 * Show configuration help
 */
program
  .command('config')
  .description('Show configuration and setup instructions')
  .action(() => {
    console.log('');
    console.log('🏚️  Cemetery of Forgotten Books - Configuration');
    console.log('═'.repeat(50));
    console.log('');
    console.log('📋 Environment Variables:');
    console.log('   SECRET_SEED - Controls user daily passwords');
    console.log('   ADMIN_SECRET_SEED - Controls admin daily passwords');
    console.log('');
    console.log('⏰ Password Reset Schedule:');
    console.log('   Both passwords reset daily at 00:00 UTC');
    console.log('');
    console.log('🔧 Development Setup:');
    console.log('   Edit wrangler.toml [vars] section for dev environment');
    console.log('');
    console.log('🔐 Production Setup:');
    console.log('   Use wrangler secrets for production:');
    console.log('   $ wrangler secret put SECRET_SEED');
    console.log('   $ wrangler secret put ADMIN_SECRET_SEED');
    console.log('');
    console.log('🔍 View Passwords:');
    console.log('   $ node scripts/admin.js passwords');
    console.log('   $ node scripts/admin.js schedule');
    console.log('');
  });

program
  .name('admin')
  .description('Cemetery of Forgotten Books - Admin CLI')
  .version('1.0.0');

program.parse();