/**
 * Database fallback mechanisms for offline/degraded mode
 */

/**
 * Static fallback data when database is unavailable
 */
const fallbackCategories = [
  { slug: 'fiction', name: 'Fiction', description: 'Literary fiction and stories' },
  { slug: 'gothic', name: 'Gothic Literature', description: 'Dark romantic literature' },
  { slug: 'classics', name: 'Classics', description: 'Classical literature' },
  { slug: 'philosophy', name: 'Philosophy', description: 'Philosophical works' },
  { slug: 'poetry', name: 'Poetry', description: 'Poetic works' },
  { slug: 'non-fiction', name: 'Non-Fiction', description: 'Non-fiction works' }
];

const fallbackBooks = [
  {
    id: 'fallback-1',
    slug: 'frankenstein-sample',
    title: 'Frankenstein (Sample)',
    author: 'Mary Shelley',
    year: 1818,
    language: 'en',
    summary: 'The classic gothic novel about a scientist who creates a monster. This is a limited sample while the database is unavailable.',
    categories: ['gothic', 'classics', 'fiction'],
    category_names: ['Gothic Literature', 'Classics', 'Fiction'],
    created_at: '2024-01-01T00:00:00Z',
    formats: { epub: { size: 0, url: null } },
    cover_key: null
  },
  {
    id: 'fallback-2', 
    slug: 'dracula-sample',
    title: 'Dracula (Sample)',
    author: 'Bram Stoker',
    year: 1897,
    language: 'en',
    summary: 'The definitive vampire novel that defined the genre. This is a limited sample while the database is unavailable.',
    categories: ['gothic', 'classics', 'fiction'],
    category_names: ['Gothic Literature', 'Classics', 'Fiction'],
    created_at: '2024-01-01T00:00:00Z',
    formats: { epub: { size: 0, url: null } },
    cover_key: null
  }
];

/**
 * Check if database is available
 * @param {object} supabase - Supabase client
 * @returns {Promise<boolean>} True if database is available
 */
export async function isDatabaseAvailable(supabase) {
  try {
    // Simple connectivity test
    const { error } = await supabase
      .from('categories')
      .select('slug')
      .limit(1);
    
    return !error;
  } catch {
    return false;
  }
}

/**
 * Get fallback categories when database is unavailable
 * @returns {object} Categories in expected format
 */
export function getFallbackCategories() {
  return {
    data: fallbackCategories,
    error: null
  };
}

/**
 * Get fallback books when database is unavailable
 * @param {object} options - Query options
 * @returns {object} Books in expected format
 */
export function getFallbackBooks(options = {}) {
  const { 
    page = 1, 
    limit = 20, 
    category = null, 
    search = null 
  } = options;
  
  let filteredBooks = [...fallbackBooks];
  
  // Apply category filter
  if (category) {
    filteredBooks = filteredBooks.filter(book => 
      book.categories.includes(category)
    );
  }
  
  // Apply search filter (simple text matching)
  if (search) {
    const searchLower = search.toLowerCase();
    filteredBooks = filteredBooks.filter(book =>
      book.title.toLowerCase().includes(searchLower) ||
      book.author.toLowerCase().includes(searchLower) ||
      (book.summary && book.summary.toLowerCase().includes(searchLower))
    );
  }
  
  // Apply pagination
  const offset = (page - 1) * limit;
  const paginatedBooks = filteredBooks.slice(offset, offset + limit);
  
  return {
    data: paginatedBooks,
    error: null,
    count: filteredBooks.length,
    pagination: {
      page,
      limit,
      total: filteredBooks.length,
      pages: Math.ceil(filteredBooks.length / limit)
    }
  };
}

/**
 * Get fallback book by slug
 * @param {string} slug - Book slug
 * @returns {object} Book data or null
 */
export function getFallbackBookBySlug(slug) {
  const book = fallbackBooks.find(b => b.slug === slug);
  return {
    data: book || null,
    error: book ? null : { message: 'Book not found in fallback data' }
  };
}

/**
 * Get fallback search results
 * @param {string} query - Search query
 * @param {object} options - Search options
 * @returns {object} Search results
 */
export function getFallbackSearchResults(query, options = {}) {
  const { limit = 20, category = null } = options;
  
  if (!query || query.trim().length === 0) {
    return {
      data: [],
      error: null
    };
  }
  
  const searchLower = query.toLowerCase();
  let results = fallbackBooks.filter(book =>
    book.title.toLowerCase().includes(searchLower) ||
    book.author.toLowerCase().includes(searchLower) ||
    (book.summary && book.summary.toLowerCase().includes(searchLower))
  );
  
  // Apply category filter
  if (category) {
    results = results.filter(book => book.categories.includes(category));
  }
  
  // Limit results
  results = results.slice(0, limit);
  
  return {
    data: results,
    error: null
  };
}

/**
 * Get fallback books by category
 * @param {string} categorySlug - Category slug
 * @param {object} options - Query options
 * @returns {object} Books in category
 */
export function getFallbackBooksByCategory(categorySlug, options = {}) {
  const { limit = 20, offset = 0 } = options;
  
  const books = fallbackBooks.filter(book => 
    book.categories.includes(categorySlug)
  );
  
  const paginatedBooks = books.slice(offset, offset + limit);
  
  return {
    data: paginatedBooks,
    error: null
  };
}

/**
 * Create offline mode banner message
 * @param {string} operation - The operation being performed
 * @returns {string} Banner message
 */
export function createOfflineBanner(operation = 'browsing') {
  return `📵 Offline Mode: Database unavailable. Showing limited sample content for ${operation}. Please try again later for full library access.`;
}

/**
 * Enhanced error response for offline mode
 * @param {string} operation - The operation that failed
 * @param {object} fallbackData - Fallback data to include
 * @returns {object} Enhanced response object
 */
export function createOfflineResponse(operation, fallbackData) {
  return {
    ...fallbackData,
    offline: true,
    message: createOfflineBanner(operation),
    timestamp: new Date().toISOString(),
    limitations: [
      'Limited sample content only',
      'No downloads available', 
      'Search functionality reduced',
      'Real-time data unavailable'
    ]
  };
}