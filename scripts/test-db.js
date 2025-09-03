#!/usr/bin/env node

/**
 * Test database connection script
 * Verifies that we can connect to Supabase and query basic data
 */

import { createSupabaseClient } from '../src/db/client.js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Simple .env file loader
function loadEnv() {
  try {
    const envFile = readFileSync(join(process.cwd(), '.env'), 'utf8');
    const lines = envFile.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=');
          process.env[key.trim()] = value.trim();
        }
      }
    }
  } catch (error) {
    // .env file doesn't exist, that's ok
  }
}

async function testConnection() {
  // Load environment variables from .env file
  loadEnv();
  
  const env = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
  };
  
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing database credentials');
    console.log('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file');
    console.log('');
    console.log('Example .env:');
    console.log('SUPABASE_URL=https://your-project-id.supabase.co');
    console.log('SUPABASE_SERVICE_ROLE_KEY=eyJ...');
    process.exit(1);
  }
  
  console.log('🔌 Testing database connection...');
  console.log(`📍 URL: ${env.SUPABASE_URL}`);
  
  try {
    const supabase = createSupabaseClient(env);
    
    // Test 1: Check if we can connect
    console.log('');
    console.log('Test 1: Basic connection...');
    const { data, error } = await supabase.from('categories').select('count').limit(1);
    
    if (error) {
      console.error('❌ Connection failed:', error.message);
      
      if (error.message.includes('JWT')) {
        console.log('💡 This looks like an authentication issue.');
        console.log('   Check that your SUPABASE_SERVICE_ROLE_KEY is correct.');
      }
      
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        console.log('💡 The database tables don\'t exist yet.');
        console.log('   Run the migration script in your Supabase SQL editor:');
        console.log('   migrations/001_initial_schema.sql');
      }
      
      process.exit(1);
    }
    
    console.log('✅ Connection successful!');
    
    // Test 2: Check if tables exist
    console.log('');
    console.log('Test 2: Checking database schema...');
    
    const tables = ['categories', 'books', 'book_categories', 'reviews'];
    for (const table of tables) {
      try {
        const { error } = await supabase.from(table).select('count').limit(1);
        if (error) {
          console.log(`❌ Table '${table}' missing or inaccessible`);
        } else {
          console.log(`✅ Table '${table}' exists`);
        }
      } catch (e) {
        console.log(`❌ Table '${table}' check failed: ${e.message}`);
      }
    }
    
    // Test 3: Check categories data
    console.log('');
    console.log('Test 3: Checking sample data...');
    
    const { data: categories, error: catError } = await supabase
      .from('categories')
      .select('*')
      .limit(3);
    
    if (catError) {
      console.log('❌ Could not fetch categories:', catError.message);
    } else {
      console.log(`✅ Found ${categories.length} categories:`);
      categories.forEach(cat => {
        console.log(`   - ${cat.name} (${cat.slug})`);
      });
    }
    
    // Test 4: Check books data
    const { data: books, error: booksError } = await supabase
      .from('books')
      .select('title, author')
      .limit(3);
    
    if (booksError) {
      console.log('📚 No books found yet (this is normal for a new database)');
      console.log('   Run "npm run seed" to add sample gothic literature');
    } else {
      console.log(`✅ Found ${books.length} books:`);
      books.forEach(book => {
        console.log(`   - "${book.title}" by ${book.author}`);
      });
    }
    
    // Test 5: Test full-text search capability
    console.log('');
    console.log('Test 4: Testing search capabilities...');
    
    try {
      const { data: searchResults, error: searchError } = await supabase
        .from('books_with_categories')
        .select('title')
        .textSearch('search_vector', 'gothic')
        .limit(1);
      
      if (searchError) {
        console.log('⚠️  Search functionality not working yet (needs books)');
      } else {
        console.log('✅ Full-text search is working');
      }
    } catch (e) {
      console.log('⚠️  Search test skipped (no books yet)');
    }
    
    console.log('');
    console.log('🎉 Database connection test completed!');
    
    if (books && books.length === 0) {
      console.log('');
      console.log('📝 Next steps:');
      console.log('   1. Run "npm run seed" to add sample books');
      console.log('   2. Start the dev server with "npm run dev"');
      console.log('   3. Visit the application and test the full workflow');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testConnection();
}

export { testConnection };