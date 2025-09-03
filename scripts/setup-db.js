#!/usr/bin/env node

/**
 * Interactive database setup script
 * Helps users configure their Supabase connection
 */

import { createInterface } from 'readline';
import { writeFileSync, readFileSync } from 'fs';
import { testConnection } from './test-db.js';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise(resolve => {
    rl.question(question, resolve);
  });
}

function updateEnvFile(supabaseUrl, serviceRoleKey) {
  try {
    // Read current .env file
    let envContent = readFileSync('.env', 'utf8');
    
    // Update the values
    envContent = envContent.replace(
      /SUPABASE_URL=.*/,
      `SUPABASE_URL=${supabaseUrl}`
    );
    envContent = envContent.replace(
      /SUPABASE_SERVICE_ROLE_KEY=.*/,
      `SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}`
    );
    
    // Write back to file
    writeFileSync('.env', envContent);
    console.log('✅ Updated .env file');
    return true;
  } catch (error) {
    console.error('❌ Failed to update .env file:', error.message);
    return false;
  }
}

async function main() {
  console.log('🏛️  Cemetery of Forgotten Books - Database Setup');
  console.log('═══════════════════════════════════════════════');
  console.log('');
  
  console.log('This script will help you connect to your Supabase database.');
  console.log('');
  console.log('First, make sure you have:');
  console.log('1. Created a Supabase project at https://supabase.com');
  console.log('2. Copied your Project URL and Service Role Key from Settings → API');
  console.log('3. Run the migration in the Supabase SQL Editor (migrations/001_initial_schema.sql)');
  console.log('');
  
  const hasSupabase = await ask('Do you have a Supabase project ready? (y/n): ');
  
  if (hasSupabase.toLowerCase() !== 'y') {
    console.log('');
    console.log('📋 Please complete these steps first:');
    console.log('');
    console.log('1. Go to https://supabase.com/dashboard');
    console.log('2. Click "New project"');
    console.log('3. Name: fbl-gothic-library');
    console.log('4. Choose region and set database password');
    console.log('5. Wait for project creation (~2 minutes)');
    console.log('6. Go to Settings → API and copy your credentials');
    console.log('7. Go to SQL Editor and run migrations/001_initial_schema.sql');
    console.log('');
    console.log('Then run this script again!');
    rl.close();
    return;
  }
  
  console.log('');
  console.log('Great! Let\'s configure your database connection.');
  console.log('');
  
  // Get Supabase URL
  const supabaseUrl = await ask('Enter your Supabase Project URL (https://xxx.supabase.co): ');
  
  if (!supabaseUrl.includes('supabase.co')) {
    console.log('❌ Invalid URL format. Should be https://your-project-id.supabase.co');
    rl.close();
    return;
  }
  
  // Get Service Role Key
  console.log('');
  const serviceRoleKey = await ask('Enter your Service Role Key (starts with eyJ...): ');
  
  if (!serviceRoleKey.startsWith('eyJ')) {
    console.log('❌ Invalid Service Role Key. Should start with "eyJ"');
    console.log('💡 Make sure you\'re using the SERVICE ROLE key, not the anon public key');
    rl.close();
    return;
  }
  
  console.log('');
  console.log('📝 Updating .env file...');
  
  const updated = updateEnvFile(supabaseUrl, serviceRoleKey);
  
  if (!updated) {
    rl.close();
    return;
  }
  
  console.log('');
  console.log('🔌 Testing database connection...');
  
  // Update environment variables for this process
  process.env.SUPABASE_URL = supabaseUrl;
  process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;
  
  try {
    await testConnection();
    console.log('');
    console.log('🎉 Database setup complete!');
    console.log('');
    console.log('📝 Next steps:');
    console.log('1. Run "npm run db:seed" to add sample gothic books');
    console.log('2. Run "npm run dev" to start the application');
    console.log('3. Visit http://localhost:8788 to test your library');
    
  } catch (error) {
    console.log('');
    console.log('❌ Connection test failed. Please check your credentials and try again.');
    console.log('');
    console.log('💡 Common issues:');
    console.log('- Make sure you ran the migration script in Supabase SQL Editor');
    console.log('- Verify you\'re using the SERVICE ROLE key, not anon public key');
    console.log('- Check that your project URL is correct');
  }
  
  rl.close();
}

main().catch(error => {
  console.error('Setup failed:', error.message);
  rl.close();
  process.exit(1);
});