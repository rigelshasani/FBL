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
import { 
  validatePagination,
  validateSearchQuery,
  validateCategory,
  validateBookSlug,
  sanitizeString
} from '../utils/validation.js';
import { databaseCache, cacheKeys } from '../utils/cache.js';

/**
 * Get paginated list of books with optional filters
 * @param {object} supabase - Supabase client
 * @param {object} options - Query options
 * @returns {Promise<object>} Books with pagination info
 */
export async function getBooks(supabase, options = {}) {
  let {
    page = 1,
    limit = 20,
    category = null,
    language = null,
    search = null,
    sort = 'created_at'
  } = options;
  
  // Input validation
  const paginationValidation = validatePagination(limit, (page - 1) * limit);
  if (!paginationValidation.valid) {
    return {
      data: null,
      error: { message: paginationValidation.errors.join(', ') }
    };
  }
  
  // Use validated pagination values
  limit = paginationValidation.limit;
  page = Math.max(1, Math.ceil(paginationValidation.offset / limit) + 1);
  
  // Validate category if provided
  if (category) {
    const categoryValidation = validateCategory(category);
    if (!categoryValidation.valid) {
      return {
        data: null,
        error: { message: categoryValidation.error }
      };
    }
    category = categoryValidation.value;
  }
  
  // Validate search query if provided  
  if (search) {
    const searchValidation = validateSearchQuery(search);
    if (!searchValidation.valid) {
      return {
        data: null,
        error: { message: searchValidation.error }
      };
    }
    search = searchValidation.value;
  }
  
  // Validate and sanitize language
  if (language) {
    language = sanitizeString(language, 10);
    if (!/^[a-z]{2,5}$/.test(language)) {
      return {
        data: null,
        error: { message: 'Invalid language code format' }
      };
    }
  }
  
  // Validate sort parameter
  const allowedSorts = ['created_at', 'title', 'author', 'year'];
  if (sort && !allowedSorts.includes(sort)) {
    sort = 'created_at'; // Default to safe value
  }
  
  // Check database availability first
  const dbAvailable = await isDatabaseAvailable(supabase);
  if (!dbAvailable) {
    const fallbackData = getFallbackBooks({ page, limit, category, search });
    return createOfflineResponse('book browsing', fallbackData);
  }
  
  const offset = (page - 1) * limit;
  
  // Try cache first (for identical queries)
  const cacheKey = cacheKeys.db('books_with_categories', 'select', {
    page, limit, category, language, search, sort
  });
  
  const cached = databaseCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  
  const result = await executeQuery(supabase, async (db) => {
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
    
    const queryResult = await query;
    
    // Handle null count gracefully
    const totalCount = queryResult.count ?? 0;
    
    return {
      ...queryResult,
      data: queryResult.data || [],
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    };
  }, 'select', 'books_with_categories');
  
  // Cache successful results for 5 minutes
  if (result.data) {
    databaseCache.set(cacheKey, result, 5 * 60 * 1000);
  }
  
  return result;
}

/**
 * Get single book by slug
 * @param {object} supabase - Supabase client
 * @param {string} slug - Book slug
 * @returns {Promise<object>} Book data
 */
export async function getBookBySlug(supabase, slug) {
  // Input validation
  if (!slug) {
    return {
      data: null,
      error: { message: 'Book slug is required' }
    };
  }
  
  const slugValidation = validateBookSlug(slug);
  if (!slugValidation.valid) {
    return {
      data: null,
      error: { message: slugValidation.error }
    };
  }
  
  const validatedSlug = slugValidation.value;
  
  // Check database availability first
  const dbAvailable = await isDatabaseAvailable(supabase);
  if (!dbAvailable) {
    const fallbackData = getFallbackBookBySlug(validatedSlug);
    if (fallbackData.data) {
      return createOfflineResponse('book details', fallbackData);
    }
    return fallbackData; // Return error if book not found
  }
  
  return executeQuery(supabase, async (db) => {
    return db
      .from('books_with_categories')
      .select('*')
      .eq('slug', validatedSlug)
      .single();
  }, 'select', 'books_with_categories');
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
  let { limit = 20, category = null } = options;
  
  // Input validation
  if (!query) {
    return {
      data: null,
      error: { message: 'Search query is required' }
    };
  }
  
  const queryValidation = validateSearchQuery(query);
  if (!queryValidation.valid) {
    return {
      data: null,
      error: { message: queryValidation.error }
    };
  }
  
  const validatedQuery = queryValidation.value;
  
  // Validate pagination
  const paginationValidation = validatePagination(limit, 0);
  if (!paginationValidation.valid) {
    return {
      data: null,
      error: { message: paginationValidation.errors.join(', ') }
    };
  }
  limit = paginationValidation.limit;
  
  // Validate category if provided
  if (category) {
    const categoryValidation = validateCategory(category);
    if (!categoryValidation.valid) {
      return {
        data: null,
        error: { message: categoryValidation.error }
      };
    }
    category = categoryValidation.value;
  }
  
  // Check database availability first
  const dbAvailable = await isDatabaseAvailable(supabase);
  if (!dbAvailable) {
    const fallbackData = getFallbackSearchResults(validatedQuery, { limit, category });
    return createOfflineResponse('search', fallbackData);
  }
  
  return executeQuery(supabase, async (db) => {
    let search = db
      .from('books_with_categories')
      .select('id, slug, title, author, summary, categories, category_names')
      .textSearch('search_vector', validatedQuery);
    
    if (category) {
      search = search.contains('categories', [category]);
    }
    
    return search.limit(limit);
  }, 'search', 'books_with_categories');
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
  }, 'select', 'categories');
}

/**
 * Get books in a specific category
 * @param {object} supabase - Supabase client
 * @param {string} categorySlug - Category slug
 * @param {object} options - Query options
 * @returns {Promise<object>} Books in category
 */
export async function getBooksByCategory(supabase, categorySlug, options = {}) {
  let { limit = 20, offset = 0 } = options;
  
  // Input validation
  if (!categorySlug) {
    return {
      data: null,
      error: { message: 'Category slug is required' }
    };
  }
  
  const categoryValidation = validateCategory(categorySlug);
  if (!categoryValidation.valid) {
    return {
      data: null,
      error: { message: categoryValidation.error }
    };
  }
  
  const validatedCategorySlug = categoryValidation.value;
  
  // Validate pagination
  const paginationValidation = validatePagination(limit, offset);
  if (!paginationValidation.valid) {
    return {
      data: null,
      error: { message: paginationValidation.errors.join(', ') }
    };
  }
  
  limit = paginationValidation.limit;
  offset = paginationValidation.offset;
  
  // Check database availability first
  const dbAvailable = await isDatabaseAvailable(supabase);
  if (!dbAvailable) {
    const fallbackData = getFallbackBooksByCategory(validatedCategorySlug, { limit, offset });
    return createOfflineResponse(`${validatedCategorySlug} category browsing`, fallbackData);
  }
  
  return executeQuery(supabase, async (db) => {
    return db
      .from('books_with_categories')
      .select('*')
      .contains('categories', [validatedCategorySlug])
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
  }, 'select', 'books_with_categories');
}

/**
 * Add a new book (for admin/upload functionality)
 * @param {object} supabase - Supabase client
 * @param {object} bookData - Book data
 * @returns {Promise<object>} Created book
 */
export async function createBook(supabase, bookData) {
  let {
    slug,
    title,
    author,
    year,
    language = 'en',
    summary,
    categories = []
  } = bookData;
  
  const { cover_key, formats } = bookData;
  
  // Input validation
  if (!slug || !title || !author) {
    return {
      data: null,
      error: { message: 'Book slug, title, and author are required' }
    };
  }
  
  // Validate slug
  const slugValidation = validateBookSlug(slug);
  if (!slugValidation.valid) {
    return {
      data: null,
      error: { message: slugValidation.error }
    };
  }
  slug = slugValidation.value;
  
  // Sanitize and validate other fields
  title = sanitizeString(title, 200);
  author = sanitizeString(author, 100);
  summary = summary ? sanitizeString(summary, 2000) : null;
  
  if (!title || !author) {
    return {
      data: null,
      error: { message: 'Title and author cannot be empty after sanitization' }
    };
  }
  
  // Validate year
  if (year !== null && year !== undefined) {
    const yearNum = parseInt(year, 10);
    if (isNaN(yearNum) || yearNum < -3000 || yearNum > new Date().getFullYear()) {
      return {
        data: null,
        error: { message: 'Invalid publication year' }
      };
    }
    year = yearNum;
  }
  
  // Validate language code
  if (language) {
    language = sanitizeString(language, 10).toLowerCase();
    if (!/^[a-z]{2,5}$/.test(language)) {
      language = 'en'; // Default to English if invalid
    }
  }
  
  // Validate categories
  if (categories && categories.length > 0) {
    const validatedCategories = [];
    for (const cat of categories) {
      const catValidation = validateCategory(cat);
      if (catValidation.valid) {
        validatedCategories.push(catValidation.value);
      }
    }
    categories = validatedCategories;
  }
  
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
  }, 'insert', 'books');
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
    
    const { count } = await db
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