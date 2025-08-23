#!/usr/bin/env node

/**
 * Integration test for authentication flow and book browsing
 * Tests the complete user journey from lock screen to book catalog
 */
async function testAuth() {
  // Generate today's password using the same logic as the server
  const secretSeed = 'demo-secret-for-testing-12345';
  
  // Get date in UTC timezone (same as server)
  const utcDate = new Date(new Date().toISOString().split('T')[0] + 'T00:00:00.000Z');
  const dateStr = utcDate.toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Use same HMAC logic as server: secretSeed as key, dateString as data
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', 
    encoder.encode(secretSeed),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(dateStr));
  const password = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 8);
  
  console.log('Date string:', dateStr);  
  console.log('Generated password:', password);
  
  // Test authentication
  try {
    const response = await fetch('http://localhost:8788/lock', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `password=${encodeURIComponent(password)}`,
      redirect: 'manual'
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.status === 302) {
      const location = response.headers.get('Location');
      console.log('Redirected to:', location);
      
      if (location.includes('/view/')) {
        console.log('✅ Authentication successful!');
        
        // Test the one-time view
        const viewResponse = await fetch(`http://localhost:8788${location}`);
        console.log('One-time view status:', viewResponse.status);
        
        if (viewResponse.ok) {
          const html = await viewResponse.text();
          if (html.includes('Welcome to the Cemetery')) {
            console.log('✅ One-time view works!');
          }
          
          if (html.includes('Browse Books')) {
            console.log('✅ Browse Books link found!');
          }
          
          if (html.includes('Admin Panel')) {
            console.log('✅ Admin Panel link found!');
            
            // Test books page
            const booksResponse = await fetch(`http://localhost:8788/books`, {
              headers: {
                'Referer': `http://localhost:8788${location}`
              }
            });
            
            console.log('Books page status:', booksResponse.status);
            if (booksResponse.ok) {
              const booksHtml = await booksResponse.text();
              if (booksHtml.includes('Book Catalog')) {
                console.log('✅ Books catalog page loads!');
              }
              if (booksHtml.includes('Cemetery of Forgotten Books')) {
                console.log('✅ Page title correct!');
              }
              
              // Test the API call that the page makes (should use one-time view as referrer)
              const apiResponse = await fetch(`http://localhost:8788/api/books?page=1&limit=12`, {
                headers: {
                  'Referer': `http://localhost:8788${location}`
                }
              });
              
              console.log('Books API status:', apiResponse.status);
              if (apiResponse.ok) {
                const apiData = await apiResponse.json();
                console.log('✅ Books API works! Books found:', apiData.books?.length || 0);
              }
            }
            
            // Test admin page
            const adminResponse = await fetch(`http://localhost:8788/admin`, {
              headers: {
                'Referer': `http://localhost:8788${location}`
              }
            });
            
            console.log('Admin page status:', adminResponse.status);
            if (adminResponse.ok) {
              const adminHtml = await adminResponse.text();
              if (adminHtml.includes('Admin Panel')) {
                console.log('✅ Admin page loads!');
              }
              if (adminHtml.includes('Daily Password')) {
                console.log('✅ Daily password section found!');
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testAuth().catch(console.error);