/**
 * API routes for books, categories, and search
 */

import { createSupabaseClient } from '../db/client.js';
import { 
  getBooks, 
  getBookBySlug, 
  getCategories, 
  searchBooks,
  getBooksByCategory 
} from '../db/queries.js';
import { 
  validateSearchQuery, 
  validateCategory, 
  validateBookSlug, 
  validatePagination,
  sanitizeURLParams 
} from '../utils/validation.js';

/**
 * Handle GET /api/books - List books with pagination and filters
 */
export async function handleBooksAPI(request, env) {
  try {
    const url = new URL(request.url);
    
    // Extract and sanitize URL parameters
    const rawParams = Object.fromEntries(url.searchParams);
    const params = sanitizeURLParams(rawParams);
    
    // Validate pagination
    const paginationValidation = validatePagination(params.limit, params.offset);
    if (!paginationValidation.valid) {
      return new Response(JSON.stringify({ 
        error: 'Invalid pagination parameters',
        details: paginationValidation.errors
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Validate category if provided
    let validatedCategory = null;
    if (params.category) {
      const categoryValidation = validateCategory(params.category);
      if (!categoryValidation.valid) {
        return new Response(JSON.stringify({ 
          error: 'Invalid category parameter',
          details: categoryValidation.error
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      validatedCategory = categoryValidation.value;
    }
    
    // Validate search query if provided
    let validatedSearch = null;
    if (params.q) {
      const searchValidation = validateSearchQuery(params.q);
      if (!searchValidation.valid) {
        return new Response(JSON.stringify({ 
          error: 'Invalid search query',
          details: searchValidation.error
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      validatedSearch = searchValidation.value;
    }
    
    const page = Math.max(1, parseInt(params.page) || 1);
    const limit = paginationValidation.limit;
    const category = validatedCategory;
    const language = params.language || null; // TODO: Add language validation
    const search = validatedSearch;
    const sort = params.sort || 'created_at'; // TODO: Add sort validation

    const supabase = createSupabaseClient(env);
    
    // Handle empty database gracefully
    try {
      const result = await getBooks(supabase, {
        page,
        limit,
        category,
        language,
        search,
        sort
      });

      return new Response(JSON.stringify({
        books: result.data || [],
        pagination: result.pagination || {
          page: 1,
          limit: limit,
          total: 0,
          pages: 0
        },
        offline: result.offline || false,
        message: result.message || null,
        limitations: result.limitations || null
      }), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=300'
      }
    });
    } catch (error) {
      console.error('Books API error:', error);
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch books',
        details: error.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('Books API outer error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle GET /api/books/:slug - Get single book details
 */
export async function handleBookDetailAPI(request, env, slug) {
  try {
    // Validate book slug
    const slugValidation = validateBookSlug(slug);
    if (!slugValidation.valid) {
      return new Response(JSON.stringify({ 
        error: 'Invalid book slug',
        details: slugValidation.error
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const supabase = createSupabaseClient(env);
    const result = await getBookBySlug(supabase, slugValidation.value);

    if (!result.data) {
      return new Response(JSON.stringify({ 
        error: 'Book not found' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Remove storage keys from public response
    const book = { ...result.data };
    if (book.formats) {
      Object.keys(book.formats).forEach(format => {
        if (book.formats[format].key) {
          delete book.formats[format].key;
        }
      });
    }
    delete book.cover_key;

    return new Response(JSON.stringify({ 
      book,
      offline: result.offline || false,
      message: result.message || null,
      limitations: result.limitations || null
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': result.offline ? 'no-cache' : 'private, max-age=600'
      }
    });

  } catch (error) {
    console.error('Book detail API error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch book details',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle GET /api/categories - List all categories
 */
export async function handleCategoriesAPI(request, env) {
  try {
    const supabase = createSupabaseClient(env);
    const result = await getCategories(supabase);

    return new Response(JSON.stringify({
      categories: result.data || [],
      offline: result.offline || false,
      message: result.message || null,
      limitations: result.limitations || null
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': result.offline ? 'no-cache' : 'private, max-age=1800' // 30 minutes
      }
    });

  } catch (error) {
    console.error('Categories API error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch categories',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle GET /api/search - Search books with full-text search
 */
export async function handleSearchAPI(request, env) {
  try {
    const url = new URL(request.url);
    
    // Extract and sanitize URL parameters
    const rawParams = Object.fromEntries(url.searchParams);
    const params = sanitizeURLParams(rawParams);
    
    // Validate search query (required)
    if (!params.q) {
      return new Response(JSON.stringify({ 
        error: 'Search query is required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const searchValidation = validateSearchQuery(params.q);
    if (!searchValidation.valid) {
      return new Response(JSON.stringify({ 
        error: 'Invalid search query',
        details: searchValidation.error
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Validate category if provided
    let validatedCategory = null;
    if (params.category) {
      const categoryValidation = validateCategory(params.category);
      if (!categoryValidation.valid) {
        return new Response(JSON.stringify({ 
          error: 'Invalid category parameter',
          details: categoryValidation.error
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      validatedCategory = categoryValidation.value;
    }
    
    // Validate pagination
    const paginationValidation = validatePagination(params.limit, params.offset);
    if (!paginationValidation.valid) {
      return new Response(JSON.stringify({ 
        error: 'Invalid pagination parameters',
        details: paginationValidation.errors
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const query = searchValidation.value;
    const category = validatedCategory;
    const limit = paginationValidation.limit;

    if (!query || query.trim().length < 2) {
      return new Response(JSON.stringify({ 
        error: 'Query must be at least 2 characters' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const supabase = createSupabaseClient(env);
    const result = await searchBooks(supabase, query.trim(), {
      limit,
      category
    });

    return new Response(JSON.stringify({
      books: result.data || [],
      query: query.trim(),
      count: result.data?.length || 0,
      offline: result.offline || false,
      message: result.message || null,
      limitations: result.limitations || null
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': result.offline ? 'no-cache' : 'private, max-age=300'
      }
    });

  } catch (error) {
    console.error('Search API error:', error);
    return new Response(JSON.stringify({ 
      error: 'Search failed',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle GET /api/categories/:slug/books - Get books in a category
 */
export async function handleCategoryBooksAPI(request, env, categorySlug) {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit')) || 20;
    const offset = parseInt(url.searchParams.get('offset')) || 0;

    const supabase = createSupabaseClient(env);
    const result = await getBooksByCategory(supabase, categorySlug, {
      limit,
      offset
    });

    return new Response(JSON.stringify({
      books: result.data || [],
      category: categorySlug,
      count: result.data?.length || 0,
      offline: result.offline || false,
      message: result.message || null,
      limitations: result.limitations || null
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': result.offline ? 'no-cache' : 'private, max-age=600'
      }
    });

  } catch (error) {
    console.error('Category books API error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch category books',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}