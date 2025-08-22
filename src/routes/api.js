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

/**
 * Handle GET /api/books - List books with pagination and filters
 */
export async function handleBooksAPI(request, env) {
  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page')) || 1;
    const limit = parseInt(url.searchParams.get('limit')) || 20;
    const category = url.searchParams.get('category') || null;
    const language = url.searchParams.get('language') || null;
    const search = url.searchParams.get('q') || null;
    const sort = url.searchParams.get('sort') || 'created_at';

    const supabase = createSupabaseClient(env);
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
      pagination: result.pagination
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
}

/**
 * Handle GET /api/books/:slug - Get single book details
 */
export async function handleBookDetailAPI(request, env, slug) {
  try {
    const supabase = createSupabaseClient(env);
    const result = await getBookBySlug(supabase, slug);

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

    return new Response(JSON.stringify({ book }), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=600'
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
      categories: result.data || []
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=1800' // 30 minutes
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
    const query = url.searchParams.get('q');
    const category = url.searchParams.get('category') || null;
    const limit = parseInt(url.searchParams.get('limit')) || 20;

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
      count: result.data?.length || 0
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=300'
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
      count: result.data?.length || 0
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=600'
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