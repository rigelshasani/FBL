/**
 * Database query functions for books, categories, and reviews
 */

import { executeQuery } from './client.js';
import { 
  isDatabaseAvailable, 
  getFallbackBooks, 
  getFallbackCategories, 
  getFallbackBookBySlug,
  getFallbackSearchResults,
  getFallbackBooksByCategory,
  createOfflineResponse
} from './fallback.js';

/**
 * Get paginated list of books with optional filters
 * @param {object} supabase - Supabase client
 * @param {object} options - Query options
 * @returns {Promise<object>} Books with pagination info
 */
export async function getBooks(supabase, options = {}) {
  const {
    page = 1,
    limit = 20,
    category = null,
    language = null,
    search = null,
    sort = 'created_at'
  } = options;
  
  // Check database availability first
  const dbAvailable = await isDatabaseAvailable(supabase);
  if (!dbAvailable) {
    const fallbackData = getFallbackBooks({ page, limit, category, search });
    return createOfflineResponse('book browsing', fallbackData);
  }
  
  const offset = (page - 1) * limit;
  
  return executeQuery(supabase, async (db) => {
    let query = db
      .from('books_with_categories')
      .select('*', { count: 'exact' });
    
    // Apply filters
    if (category) {
      query = query.contains('categories', [category]);
    }
    
    if (language) {
      query = query.eq('language', language);
    }
    
    if (search) {
      // Use full-text search
      query = query.textSearch('search_vector', search);
    }
    
    // Apply sorting
    const sortField = sort === 'title' ? 'title' : 'created_at';
    const ascending = sort === 'title';
    
    query = query
      .order(sortField, { ascending })
      .range(offset, offset + limit - 1);
    
    const result = await query;
    
    // Handle null count gracefully
    const totalCount = result.count ?? 0;
    
    return {
      ...result,
      data: result.data || [],
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    };
  });
}

/**
 * Get single book by slug
 * @param {object} supabase - Supabase client
 * @param {string} slug - Book slug
 * @returns {Promise<object>} Book data
 */
export async function getBookBySlug(supabase, slug) {
  // Check database availability first
  const dbAvailable = await isDatabaseAvailable(supabase);
  if (!dbAvailable) {
    const fallbackData = getFallbackBookBySlug(slug);
    if (fallbackData.data) {
      return createOfflineResponse('book details', fallbackData);
    }
    return fallbackData; // Return error if book not found
  }
  
  return executeQuery(supabase, async (db) => {
    return db
      .from('books_with_categories')
      .select('*')
      .eq('slug', slug)
      .single();
  });
}

/**
 * Get book with statistics (review count, rating)
 * @param {object} supabase - Supabase client  
 * @param {string} slug - Book slug
 * @returns {Promise<object>} Book with stats
 */
export async function getBookWithStats(supabase, slug) {
  return executeQuery(supabase, async (db) => {
    const { data: book } = await db
      .from('books_with_categories')
      .select('*')
      .eq('slug', slug)
      .single();
    
    if (!book) {
      return { data: null };
    }
    
    const { data: stats } = await db
      .from('book_stats')
      .select('*')
      .eq('slug', slug)
      .single();
    
    return {
      data: {
        ...book,
        stats: stats || { review_count: 0, avg_rating: null, approved_review_count: 0 }
      }
    };
  });
}

/**
 * Search books using full-text search
 * @param {object} supabase - Supabase client
 * @param {string} query - Search query
 * @param {object} options - Search options
 * @returns {Promise<object>} Search results
 */
export async function searchBooks(supabase, query, options = {}) {
  const { limit = 20, category = null } = options;
  
  // Check database availability first
  const dbAvailable = await isDatabaseAvailable(supabase);
  if (!dbAvailable) {
    const fallbackData = getFallbackSearchResults(query, { limit, category });
    return createOfflineResponse('search', fallbackData);
  }
  
  return executeQuery(supabase, async (db) => {
    let search = db
      .from('books_with_categories')
      .select('id, slug, title, author, summary, categories, category_names')
      .textSearch('search_vector', query);
    
    if (category) {
      search = search.contains('categories', [category]);
    }
    
    return search.limit(limit);
  });
}

/**
 * Get all categories
 * @param {object} supabase - Supabase client
 * @returns {Promise<object>} Categories list
 */
export async function getCategories(supabase) {
  // Check database availability first
  const dbAvailable = await isDatabaseAvailable(supabase);
  if (!dbAvailable) {
    const fallbackData = getFallbackCategories();
    return createOfflineResponse('categories', fallbackData);
  }
  
  return executeQuery(supabase, async (db) => {
    return db
      .from('categories')
      .select('*')
      .order('name');
  });
}

/**
 * Get books in a specific category
 * @param {object} supabase - Supabase client
 * @param {string} categorySlug - Category slug
 * @param {object} options - Query options
 * @returns {Promise<object>} Books in category
 */
export async function getBooksByCategory(supabase, categorySlug, options = {}) {
  const { limit = 20, offset = 0 } = options;
  
  // Check database availability first
  const dbAvailable = await isDatabaseAvailable(supabase);
  if (!dbAvailable) {
    const fallbackData = getFallbackBooksByCategory(categorySlug, { limit, offset });
    return createOfflineResponse(`${categorySlug} category browsing`, fallbackData);
  }
  
  return executeQuery(supabase, async (db) => {
    return db
      .from('books_with_categories')
      .select('*')
      .contains('categories', [categorySlug])
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
  });
}

/**
 * Add a new book (for admin/upload functionality)
 * @param {object} supabase - Supabase client
 * @param {object} bookData - Book data
 * @returns {Promise<object>} Created book
 */
export async function createBook(supabase, bookData) {
  const {
    slug,
    title,
    author,
    year,
    language = 'en',
    summary,
    cover_key,
    formats,
    categories = []
  } = bookData;
  
  return executeQuery(supabase, async (db) => {
    // Insert book
    const { data: book, error: bookError } = await db
      .from('books')
      .insert({
        slug,
        title,
        author,
        year,
        language,
        summary,
        cover_key,
        formats
      })
      .select()
      .single();
    
    if (bookError) throw bookError;
    
    // Insert category associations
    if (categories.length > 0) {
      const categoryInserts = categories.map(categorySlug => ({
        book_id: book.id,
        category_slug: categorySlug
      }));
      
      const { error: categoryError } = await db
        .from('book_categories')
        .insert(categoryInserts);
      
      if (categoryError) throw categoryError;
    }
    
    return { data: book };
  });
}

/**
 * Get reviews for a book
 * @param {object} supabase - Supabase client
 * @param {string} bookId - Book ID
 * @param {object} options - Query options
 * @returns {Promise<object>} Reviews
 */
export async function getBookReviews(supabase, bookId, options = {}) {
  const { limit = 10, offset = 0, approved = true } = options;
  
  return executeQuery(supabase, async (db) => {
    let query = db
      .from('reviews')
      .select('id, created_at, stars, body, approved')
      .eq('book_id', bookId);
    
    if (approved) {
      query = query.eq('approved', true);
    }
    
    return query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
  });
}

/**
 * Add a review for a book
 * @param {object} supabase - Supabase client
 * @param {object} reviewData - Review data
 * @returns {Promise<object>} Created review
 */
export async function createReview(supabase, reviewData) {
  const { book_id, stars, body, ip_hash } = reviewData;
  
  return executeQuery(supabase, async (db) => {
    return db
      .from('reviews')
      .insert({
        book_id,
        stars,
        body,
        ip_hash,
        approved: true // Auto-approve for now, moderation later
      })
      .select()
      .single();
  });
}

/**
 * Check review rate limit for IP hash
 * @param {object} supabase - Supabase client
 * @param {string} ipHash - Hashed IP address
 * @returns {Promise<object>} Rate limit info
 */
export async function checkReviewRateLimit(supabase, ipHash) {
  return executeQuery(supabase, async (db) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { data, count } = await db
      .from('reviews')
      .select('id', { count: 'exact' })
      .eq('ip_hash', ipHash)
      .gte('created_at', today.toISOString());
    
    return {
      data: {
        count: count || 0,
        limit: 5, // Max 5 reviews per day per IP
        remaining: Math.max(0, 5 - (count || 0))
      }
    };
  });
}