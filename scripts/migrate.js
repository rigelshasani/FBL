#!/usr/bin/env node

/**
 * Database migration script for Supabase
 * Applies SQL migrations to the database
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

const MIGRATIONS_DIR = 'migrations';

/**
 * Get all migration files in order
 */
function getMigrationFiles() {
  try {
    const files = readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    return files.map(file => ({
      name: file,
      path: join(MIGRATIONS_DIR, file),
      content: readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
    }));
  } catch (error) {
    console.error('Error reading migrations directory:', error.message);
    process.exit(1);
  }
}

/**
 * Create migration tracking table if it doesn't exist
 */
async function ensureMigrationTable(supabase) {
  const { error } = await supabase.rpc('exec', {
    query: `
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      );
    `
  });
  
  if (error) {
    console.error('Error creating migration table:', error);
    throw error;
  }
}

/**
 * Get list of applied migrations
 */
async function getAppliedMigrations(supabase) {
  const { data, error } = await supabase
    .from('_migrations')
    .select('name')
    .order('applied_at');
  
  if (error) {
    console.error('Error fetching applied migrations:', error);
    throw error;
  }
  
  return data.map(row => row.name);
}

/**
 * Apply a single migration
 */
async function applyMigration(supabase, migration) {
  console.log(`Applying migration: ${migration.name}`);
  
  try {
    // Execute the migration SQL
    const { error: migrationError } = await supabase.rpc('exec', {
      query: migration.content
    });
    
    if (migrationError) {
      console.error(`Migration ${migration.name} failed:`, migrationError);
      throw migrationError;
    }
    
    // Record the migration as applied
    const { error: recordError } = await supabase
      .from('_migrations')
      .insert({ name: migration.name });
    
    if (recordError) {
      console.error(`Failed to record migration ${migration.name}:`, recordError);
      throw recordError;
    }
    
    console.log(`✓ Migration ${migration.name} applied successfully`);
    
  } catch (error) {
    console.error(`✗ Migration ${migration.name} failed:`, error.message);
    throw error;
  }
}

/**
 * Main migration function
 */
async function migrate() {
  // Check environment variables
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    process.exit(1);
  }
  
  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  console.log('Starting database migration...');
  
  try {
    // Ensure migration tracking table exists
    await ensureMigrationTable(supabase);
    
    // Get migration files and applied migrations
    const migrationFiles = getMigrationFiles();
    const appliedMigrations = await getAppliedMigrations(supabase);
    
    console.log(`Found ${migrationFiles.length} migration files`);
    console.log(`${appliedMigrations.length} migrations already applied`);
    
    // Filter out already applied migrations
    const pendingMigrations = migrationFiles.filter(
      migration => !appliedMigrations.includes(migration.name)
    );
    
    if (pendingMigrations.length === 0) {
      console.log('✓ All migrations are up to date');
      return;
    }
    
    console.log(`Applying ${pendingMigrations.length} pending migrations...`);
    
    // Apply each pending migration
    for (const migration of pendingMigrations) {
      await applyMigration(supabase, migration);
    }
    
    console.log('✓ All migrations completed successfully');
    
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

// Run migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrate();
}

export { migrate };