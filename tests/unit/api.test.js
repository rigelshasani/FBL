import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  handleBooksAPI,
  handleBookDetailAPI,
  handleCategoriesAPI,
  handleSearchAPI 
} from '../../src/routes/api.js';

// Mock the database functions
vi.mock('../../src/db/client.js', () => ({
  createSupabaseClient: vi.fn(() => ({}))
}));

vi.mock('../../src/db/queries.js', () => ({
  getBooks: vi.fn(),
  getBookBySlug: vi.fn(),
  getCategories: vi.fn(),
  searchBooks: vi.fn(),
  getBooksByCategory: vi.fn()
}));

import { getBooks, getBookBySlug, getCategories, searchBooks } from '../../src/db/queries.js';

describe('Books API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleBooksAPI', () => {
    it('should return books with pagination', async () => {
      const mockBooks = [
        { id: '1', title: 'Test Book', author: 'Test Author' }
      ];
      
      getBooks.mockResolvedValue({
        data: mockBooks,
        pagination: { page: 1, limit: 20, total: 1, pages: 1 }
      });

      const request = new Request('http://localhost/api/books');
      const env = { SUPABASE_URL: 'test', SUPABASE_SERVICE_ROLE_KEY: 'test' };
      
      const response = await handleBooksAPI(request, env);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.books).toEqual(mockBooks);
      expect(data.pagination.total).toBe(1);
    });

    it('should handle database errors gracefully', async () => {
      getBooks.mockResolvedValue({
        data: null,
        error: {
          message: 'Unable to load books from cemetery archives',
          code: 'CONNECTION_ERROR',
          retryable: true
        }
      });

      const request = new Request('http://localhost/api/books');
      const env = { SUPABASE_URL: 'test', SUPABASE_SERVICE_ROLE_KEY: 'test' };
      
      const response = await handleBooksAPI(request, env);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.books).toEqual([]);
      expect(data.offline).toBe(true);
      expect(data.message).toBe('Unable to load books from cemetery archives');
      expect(data.pagination.total).toBe(0);
    });

    it('should handle query parameters', async () => {
      getBooks.mockResolvedValue({
        data: [],
        pagination: { page: 2, limit: 10, total: 0, pages: 0 }
      });

      const request = new Request('http://localhost/api/books?page=2&limit=10&category=fiction');
      const env = { SUPABASE_URL: 'test', SUPABASE_SERVICE_ROLE_KEY: 'test' };
      
      await handleBooksAPI(request, env);

      expect(getBooks).toHaveBeenCalledWith({}, {
        page: 2,
        limit: 10,
        category: 'fiction',
        language: null,
        search: null,
        sort: 'created_at'
      });
    });
  });

  describe('handleBookDetailAPI', () => {
    it('should return book details without storage keys', async () => {
      const mockBook = {
        id: '1',
        title: 'Test Book',
        cover_key: 'covers/test.webp',
        formats: {
          epub: { key: 'books/test.epub', bytes: 123456 }
        }
      };

      getBookBySlug.mockResolvedValue({ data: mockBook });

      const request = new Request('http://localhost/api/books/test-book');
      const env = { SUPABASE_URL: 'test', SUPABASE_SERVICE_ROLE_KEY: 'test' };
      
      const response = await handleBookDetailAPI(request, env, 'test-book');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.book.title).toBe('Test Book');
      expect(data.book.cover_key).toBeUndefined();
      expect(data.book.formats.epub.key).toBeUndefined();
      expect(data.book.formats.epub.bytes).toBe(123456);
    });

    it('should return 404 for non-existent book', async () => {
      getBookBySlug.mockResolvedValue({ data: null });

      const request = new Request('http://localhost/api/books/nonexistent');
      const env = { SUPABASE_URL: 'test', SUPABASE_SERVICE_ROLE_KEY: 'test' };
      
      const response = await handleBookDetailAPI(request, env, 'nonexistent');
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.book).toBeNull();
      expect(data.message).toBe('This volume has been lost to the cemetery mists');
    });

    it('should handle database errors gracefully', async () => {
      getBookBySlug.mockResolvedValue({
        data: null,
        error: {
          message: 'Cemetery archives temporarily unavailable',
          code: 'CONNECTION_ERROR',
          retryable: true
        }
      });

      const request = new Request('http://localhost/api/books/test-book');
      const env = { SUPABASE_URL: 'test', SUPABASE_SERVICE_ROLE_KEY: 'test' };
      
      const response = await handleBookDetailAPI(request, env, 'test-book');
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.book).toBeNull();
      expect(data.offline).toBe(true);
      expect(data.message).toBe('Cemetery archives temporarily unavailable');
    });
  });

  describe('handleCategoriesAPI', () => {
    it('should return all categories', async () => {
      const mockCategories = [
        { slug: 'fiction', name: 'Fiction', description: 'Literary fiction' }
      ];

      getCategories.mockResolvedValue({ data: mockCategories });

      const request = new Request('http://localhost/api/categories');
      const env = { SUPABASE_URL: 'test', SUPABASE_SERVICE_ROLE_KEY: 'test' };
      
      const response = await handleCategoriesAPI(request, env);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.categories).toEqual(mockCategories);
    });
  });

  describe('handleSearchAPI', () => {
    it('should return search results', async () => {
      const mockResults = [
        { id: '1', title: 'Matching Book', author: 'Test Author' }
      ];

      searchBooks.mockResolvedValue({ data: mockResults });

      const request = new Request('http://localhost/api/search?q=test');
      const env = { SUPABASE_URL: 'test', SUPABASE_SERVICE_ROLE_KEY: 'test' };
      
      const response = await handleSearchAPI(request, env);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.books).toEqual(mockResults);
      expect(data.query).toBe('test');
      expect(data.count).toBe(1);
    });

    it('should reject short queries', async () => {
      const request = new Request('http://localhost/api/search?q=a');
      const env = { SUPABASE_URL: 'test', SUPABASE_SERVICE_ROLE_KEY: 'test' };
      
      const response = await handleSearchAPI(request, env);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid search query');
    });
  });
});