/**
 * Book browsing and detail page routes
 */

import { createSupabaseClient } from '../db/client.js';
import { 
  getBooks, 
  getBookBySlug, 
  getCategories,
  searchBooks 
} from '../db/queries.js';

/**
 * Handle GET /books - Book catalog/browse page
 */
export async function handleBooksPage(request) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page')) || 1;
  const category = url.searchParams.get('category') || null;
  const search = url.searchParams.get('q') || null;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${search ? `Search: ${search}` : (category ? `${category} Books` : 'Book Catalog')} - Cemetery of Forgotten Books</title>
  <meta name="description" content="Browse the collection of forgotten books">
  <meta name="robots" content="noindex, nofollow">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: Georgia, 'Times New Roman', serif;
      background: linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%);
      color: #e8e8e8;
      min-height: 100vh;
      padding: 2rem;
    }
    
    .lock-button {
      position: fixed;
      top: 2rem;
      left: 2rem;
      width: 3rem;
      height: 3rem;
      background: rgba(0, 0, 0, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 6px;
      color: #e8e8e8;
      text-decoration: none;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;
      transition: all 0.2s ease;
      backdrop-filter: blur(10px);
      z-index: 1000;
    }
    
    .lock-button:hover {
      background: rgba(0, 0, 0, 0.9);
      border-color: rgba(255, 255, 255, 0.5);
      transform: scale(1.05);
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    
    .header {
      text-align: center;
      margin-bottom: 3rem;
    }
    
    .header h1 {
      font-size: 2.5rem;
      font-weight: 300;
      letter-spacing: 2px;
      margin-bottom: 0.5rem;
    }
    
    .header .subtitle {
      font-size: 1rem;
      opacity: 0.7;
      font-style: italic;
      color: #8B0000;
    }
    
    .nav {
      display: flex;
      justify-content: center;
      gap: 2rem;
      margin-bottom: 3rem;
      flex-wrap: wrap;
    }
    
    .nav a {
      color: #e8e8e8;
      text-decoration: none;
      padding: 0.5rem 1rem;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      transition: all 0.2s ease;
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .nav a:hover, .nav a.active {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.4);
    }
    
    .search-form {
      max-width: 500px;
      margin: 0 auto 3rem;
      display: flex;
      gap: 1rem;
    }
    
    .search-form input {
      flex: 1;
      padding: 0.8rem;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      color: #e8e8e8;
      font-size: 1rem;
    }
    
    .search-form button {
      padding: 0.8rem 1.5rem;
      background: rgba(139, 0, 0, 0.3);
      border: 1px solid #8B0000;
      border-radius: 4px;
      color: #e8e8e8;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .search-form button:hover {
      background: rgba(139, 0, 0, 0.5);
    }
    
    .books-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 2rem;
      margin-bottom: 3rem;
    }
    
    .book-card {
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px 8px 0 0;
      overflow: hidden;
      transition: all 0.3s ease;
      cursor: pointer;
    }
    
    .book-card:hover {
      transform: translateY(-5px);
      border-color: rgba(255, 255, 255, 0.3);
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.5);
    }
    
    .book-cover {
      width: 100%;
      height: 250px;
      background: linear-gradient(135deg, #2a2a2a, #1a1a1a);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #666;
      font-size: 3rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .book-info {
      padding: 1.5rem;
    }
    
    .book-title {
      font-size: 1.1rem;
      font-weight: bold;
      margin-bottom: 0.5rem;
      line-height: 1.3;
    }
    
    .book-author {
      color: #b8860b;
      font-size: 0.9rem;
      margin-bottom: 0.5rem;
    }
    
    .book-year {
      color: #888;
      font-size: 0.8rem;
    }
    
    .book-categories {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 1rem;
    }
    
    .category-tag {
      background: rgba(139, 0, 0, 0.2);
      border: 1px solid rgba(139, 0, 0, 0.4);
      padding: 0.2rem 0.5rem;
      border-radius: 3px;
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .loading {
      text-align: center;
      padding: 3rem;
      color: #888;
    }
    
    .empty {
      text-align: center;
      padding: 3rem;
      color: #888;
    }
    
    .pagination {
      display: flex;
      justify-content: center;
      gap: 1rem;
      margin-top: 3rem;
    }
    
    .pagination a, .pagination span {
      padding: 0.5rem 1rem;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      color: #e8e8e8;
      text-decoration: none;
      transition: all 0.2s ease;
    }
    
    .pagination a:hover {
      background: rgba(255, 255, 255, 0.1);
    }
    
    .pagination .current {
      background: rgba(139, 0, 0, 0.3);
      border-color: #8B0000;
    }
  </style>
</head>
<body>
  <a href="/lock" class="lock-button" title="Re-authenticate">🔒</a>
  
  <div class="container">
    <header class="header">
      <h1>Book Catalog</h1>
      <p class="subtitle">Cemetery of Forgotten Books</p>
    </header>
    
    <nav class="nav">
      <a href="/books" ${!category && !search ? 'class="active"' : ''}>All Books</a>
      <a href="/books?category=fiction" ${category === 'fiction' ? 'class="active"' : ''}>Fiction</a>
      <a href="/books?category=gothic" ${category === 'gothic' ? 'class="active"' : ''}>Gothic</a>
      <a href="/books?category=philosophy" ${category === 'philosophy' ? 'class="active"' : ''}>Philosophy</a>
      <a href="/books?category=classics" ${category === 'classics' ? 'class="active"' : ''}>Classics</a>
      <a href="/">Back to Cemetery</a>
    </nav>
    
    <form class="search-form" method="GET" action="/books">
      <input type="text" name="q" placeholder="Search books..." value="${search || ''}" />
      <button type="submit">Search</button>
    </form>
    
    <div class="books-grid" id="books-grid">
      <div class="loading">Loading books...</div>
    </div>
    
    <div class="pagination" id="pagination"></div>
  </div>
  
  <script>
    // Prevent caching and auto-expire
    if (performance.navigation.type === 1) {
      window.location.href = '/lock';
    }
    
    setTimeout(() => {
      window.location.href = '/lock';
    }, 60000); // 1 minute
    
    // Load books from API
    const urlParams = new URLSearchParams(window.location.search);
    const page = urlParams.get('page') || 1;
    const category = urlParams.get('category') || '';
    const search = urlParams.get('q') || '';
    
    let apiUrl = '/api/books?page=' + page + '&limit=12';
    if (category) apiUrl += '&category=' + encodeURIComponent(category);
    if (search) apiUrl += '&q=' + encodeURIComponent(search);
    
    fetch(apiUrl)
      .then(response => response.json())
      .then(data => {
        const grid = document.getElementById('books-grid');
        const pagination = document.getElementById('pagination');
        
        if (data.books && data.books.length > 0) {
          grid.innerHTML = data.books.map(book => {
            const categories = book.category_names || [];
            return \`
              <div class="book-card" onclick="window.location.href='/books/\${book.slug}'">
                <div class="book-cover">📚</div>
                <div class="book-info">
                  <div class="book-title">\${book.title}</div>
                  <div class="book-author">by \${book.author}</div>
                  \${book.year ? \`<div class="book-year">\${book.year}</div>\` : ''}
                  \${categories.length > 0 ? \`
                    <div class="book-categories">
                      \${categories.map(cat => \`<span class="category-tag">\${cat}</span>\`).join('')}
                    </div>
                  \` : ''}
                </div>
              </div>
            \`;
          }).join('');
          
          // Build pagination
          if (data.pagination && data.pagination.pages > 1) {
            let paginationHtml = '';
            const currentPage = data.pagination.page;
            const totalPages = data.pagination.pages;
            
            if (currentPage > 1) {
              const prevUrl = updateUrlParam('page', currentPage - 1);
              paginationHtml += \`<a href="\${prevUrl}">← Previous</a>\`;
            }
            
            for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
              const pageUrl = updateUrlParam('page', i);
              if (i === currentPage) {
                paginationHtml += \`<span class="current">\${i}</span>\`;
              } else {
                paginationHtml += \`<a href="\${pageUrl}">\${i}</a>\`;
              }
            }
            
            if (currentPage < totalPages) {
              const nextUrl = updateUrlParam('page', currentPage + 1);
              paginationHtml += \`<a href="\${nextUrl}">Next →</a>\`;
            }
            
            pagination.innerHTML = paginationHtml;
          }
        } else {
          grid.innerHTML = '<div class="empty">No books found in this cemetery section.</div>';
        }
      })
      .catch(error => {
        console.error('Failed to load books:', error);
        document.getElementById('books-grid').innerHTML = '<div class="empty">Failed to load books.</div>';
      });
    
    function updateUrlParam(param, value) {
      const url = new URL(window.location);
      url.searchParams.set(param, value);
      return url.pathname + url.search;
    }
    
    // Prevent back button caching
    window.addEventListener('pageshow', function(event) {
      if (event.persisted) {
        window.location.href = '/lock';
      }
    });
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { 
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Frame-Options': 'DENY',
      'Vary': '*'
    }
  });
}

/**
 * Handle GET /books/:slug - Individual book detail page
 */
export async function handleBookDetailPage(request, env, slug) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title id="page-title">Book Details - Cemetery of Forgotten Books</title>
  <meta name="description" content="Book details from the cemetery collection">
  <meta name="robots" content="noindex, nofollow">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: Georgia, 'Times New Roman', serif;
      background: linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%);
      color: #e8e8e8;
      min-height: 100vh;
      padding: 2rem;
    }
    
    .lock-button {
      position: fixed;
      top: 2rem;
      left: 2rem;
      width: 3rem;
      height: 3rem;
      background: rgba(0, 0, 0, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 6px;
      color: #e8e8e8;
      text-decoration: none;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;
      transition: all 0.2s ease;
      backdrop-filter: blur(10px);
      z-index: 1000;
    }
    
    .lock-button:hover {
      background: rgba(0, 0, 0, 0.9);
      border-color: rgba(255, 255, 255, 0.5);
      transform: scale(1.05);
    }
    
    .container {
      max-width: 900px;
      margin: 0 auto;
    }
    
    .back-link {
      display: inline-block;
      margin-bottom: 2rem;
      color: #b8860b;
      text-decoration: none;
      font-size: 0.9rem;
    }
    
    .back-link:hover {
      text-decoration: underline;
    }
    
    .book-detail {
      display: grid;
      grid-template-columns: 250px 1fr;
      gap: 3rem;
      margin-bottom: 3rem;
    }
    
    .book-cover-large {
      width: 100%;
      height: 350px;
      background: linear-gradient(135deg, #2a2a2a, #1a1a1a);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #666;
      font-size: 4rem;
    }
    
    .book-meta h1 {
      font-size: 2.5rem;
      font-weight: 300;
      margin-bottom: 1rem;
      line-height: 1.2;
    }
    
    .book-author {
      font-size: 1.3rem;
      color: #b8860b;
      margin-bottom: 1rem;
    }
    
    .book-year {
      color: #888;
      margin-bottom: 2rem;
    }
    
    .book-summary {
      line-height: 1.6;
      margin-bottom: 2rem;
      font-size: 1.1rem;
    }
    
    .book-categories {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 2rem;
    }
    
    .category-tag {
      background: rgba(139, 0, 0, 0.2);
      border: 1px solid rgba(139, 0, 0, 0.4);
      padding: 0.3rem 0.7rem;
      border-radius: 4px;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .download-section {
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 2rem;
      margin-bottom: 3rem;
    }
    
    .download-section h3 {
      margin-bottom: 1rem;
      color: #d4af37;
    }
    
    .download-links {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
    }
    
    .download-link {
      background: rgba(139, 0, 0, 0.3);
      border: 1px solid #8B0000;
      padding: 0.8rem 1.5rem;
      border-radius: 4px;
      color: #e8e8e8;
      text-decoration: none;
      transition: all 0.2s ease;
      text-transform: uppercase;
      font-size: 0.9rem;
      letter-spacing: 1px;
    }
    
    .download-link:hover {
      background: rgba(139, 0, 0, 0.5);
      transform: translateY(-2px);
    }
    
    .loading {
      text-align: center;
      padding: 3rem;
      color: #888;
    }
    
    .error {
      text-align: center;
      padding: 3rem;
      color: #ff6b6b;
    }
    
    @media (max-width: 768px) {
      .book-detail {
        grid-template-columns: 1fr;
        text-align: center;
      }
      
      .book-cover-large {
        width: 200px;
        height: 280px;
        margin: 0 auto;
      }
    }
  </style>
</head>
<body>
  <a href="/lock" class="lock-button" title="Re-authenticate">🔒</a>
  
  <div class="container">
    <a href="/books" class="back-link">← Back to Catalog</a>
    
    <div id="book-content">
      <div class="loading">Loading book details...</div>
    </div>
  </div>
  
  <script>
    // Prevent caching and auto-expire
    if (performance.navigation.type === 1) {
      window.location.href = '/lock';
    }
    
    setTimeout(() => {
      window.location.href = '/lock';
    }, 60000);
    
    // Load book details
    const slug = '${slug}';
    
    fetch('/api/books/' + slug)
      .then(response => {
        if (!response.ok) {
          throw new Error('Book not found');
        }
        return response.json();
      })
      .then(data => {
        const book = data.book;
        document.getElementById('page-title').textContent = book.title + ' - Cemetery of Forgotten Books';
        
        const categories = book.category_names || [];
        const formats = book.formats || {};
        
        document.getElementById('book-content').innerHTML = \`
          <div class="book-detail">
            <div class="book-cover-large">📚</div>
            <div class="book-meta">
              <h1>\${book.title}</h1>
              <div class="book-author">by \${book.author}</div>
              \${book.year ? \`<div class="book-year">\${book.year}</div>\` : ''}
              \${book.summary ? \`<div class="book-summary">\${book.summary}</div>\` : ''}
              \${categories.length > 0 ? \`
                <div class="book-categories">
                  \${categories.map(cat => \`<span class="category-tag">\${cat}</span>\`).join('')}
                </div>
              \` : ''}
            </div>
          </div>
          
          \${Object.keys(formats).length > 0 ? \`
            <div class="download-section">
              <h3>Download Formats</h3>
              <div class="download-links">
                \${Object.entries(formats).map(([format, info]) => 
                  \`<a href="/download/\${book.slug}/\${format}" class="download-link">
                    \${format.toUpperCase()} (\${formatBytes(info.bytes)})
                  </a>\`
                ).join('')}
              </div>
            </div>
          \` : ''}
        \`;
      })
      .catch(error => {
        console.error('Failed to load book:', error);
        document.getElementById('book-content').innerHTML = \`
          <div class="error">
            <h2>Book Not Found</h2>
            <p>This book seems to have been lost to time.</p>
            <a href="/books" class="back-link">Return to the catalog</a>
          </div>
        \`;
      });
    
    function formatBytes(bytes) {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    // Prevent back button caching
    window.addEventListener('pageshow', function(event) {
      if (event.persisted) {
        window.location.href = '/lock';
      }
    });
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { 
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Frame-Options': 'DENY',
      'Vary': '*'
    }
  });
}