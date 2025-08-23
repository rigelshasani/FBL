#!/usr/bin/env node

/**
 * Get today's user and admin passwords
 */
async function getPasswords() {
  const secretSeed = 'demo-secret-for-testing-12345';
  
  // Get date in UTC timezone
  const utcDate = new Date(new Date().toISOString().split('T')[0] + 'T00:00:00.000Z');
  const dateStr = utcDate.toISOString().split('T')[0]; // YYYY-MM-DD
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', 
    encoder.encode(secretSeed),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  // User password
  const userSignature = await crypto.subtle.sign('HMAC', key, encoder.encode(dateStr));
  const userPassword = Array.from(new Uint8Array(userSignature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 8);
  
  // Admin password
  const adminSignature = await crypto.subtle.sign('HMAC', key, encoder.encode(`admin:${dateStr}`));
  const adminPassword = Array.from(new Uint8Array(adminSignature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 12);
  
  console.log('Date:', dateStr);
  console.log('User password (8 chars):', userPassword);  
  console.log('Admin password (12 chars):', adminPassword);
  console.log('');
  console.log('🔓 User access: http://localhost:8788/lock');
  console.log('🔐 Admin access: http://localhost:8788/admin');
}

getPasswords().catch(console.error);