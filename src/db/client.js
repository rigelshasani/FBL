/**
 * Supabase database client configuration
 */

import { createClient } from '@supabase/supabase-js';

/**
 * Create Supabase client with service role key
 * @param {object} env - Environment variables
 * @returns {object} Supabase client
 */
export function createSupabaseClient(env) {
  if (!env.SUPABASE_URL) {
    throw new Error('SUPABASE_URL is required');
  }
  
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
  }
  
  return createClient(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: {
          'User-Agent': 'FBL-Gothic-Library/1.0'
        }
      }
    }
  );
}

/**
 * Execute database query with error handling
 * @param {object} supabase - Supabase client
 * @param {Function} queryFn - Query function to execute
 * @returns {Promise<object>} Query result
 */
export async function executeQuery(supabase, queryFn) {
  try {
    const result = await queryFn(supabase);
    
    if (result.error) {
      console.error('Database query error:', result.error);
      throw new Error(`Database error: ${result.error.message}`);
    }
    
    return result;
  } catch (error) {
    console.error('Database execution error:', error);
    throw error;
  }
}