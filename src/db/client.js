/**
 * Supabase database client configuration
 */

import { createClient } from '@supabase/supabase-js';
import { logDatabaseOperation, PerformanceTracker, logger } from '../monitoring/logger.js';

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
 * Execute database query with error handling and monitoring
 * @param {object} supabase - Supabase client
 * @param {Function} queryFn - Query function to execute
 * @param {string} operation - Operation name for logging
 * @param {string} table - Table name for logging
 * @returns {Promise<object>} Query result
 */
export async function executeQuery(supabase, queryFn, operation = 'query', table = 'unknown') {
  const tracker = new PerformanceTracker(`db_${operation}`, logger.child({ table }));
  
  try {
    const result = await queryFn(supabase);
    
    if (result.error) {
      tracker.error(new Error(result.error.message), { table, operation });
      logDatabaseOperation(operation, table, Date.now() - tracker.startTime, false, result.error);
      throw new Error(`Database error: ${result.error.message}`);
    }
    
    const duration = tracker.finish(true, { 
      table, 
      operation, 
      rowCount: Array.isArray(result.data) ? result.data.length : result.data ? 1 : 0 
    });
    
    logDatabaseOperation(operation, table, duration, true);
    return result;
    
  } catch (error) {
    tracker.error(error, { table, operation });
    logDatabaseOperation(operation, table, Date.now() - tracker.startTime, false, error);
    throw error;
  }
}