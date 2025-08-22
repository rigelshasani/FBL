import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createSupabaseClient, executeQuery } from '../../src/db/client.js';
import { 
  getBooks, 
  getBookBySlug, 
  searchBooks, 
  getCategories,
  createBook,
  getBookReviews,
  createReview,
  checkReviewRateLimit
} from '../../src/db/queries.js';

// Create chainable mock query object
const createMockQuery = (finalResult) => {
  const mockQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    textSearch: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis()
  };
  
  // Set the final result for terminal methods
  mockQuery.select.mockResolvedValue(finalResult);
  mockQuery.single.mockResolvedValue(finalResult);
  mockQuery.limit.mockResolvedValue(finalResult);
  
  return mockQuery;
};

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(),
  rpc: vi.fn()
};

// Mock createClient from @supabase/supabase-js
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient)
}));

describe('Database Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  describe('createSupabaseClient', () => {
    it('should create client with valid config', () => {
      const env = {
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-key'
      };
      
      const client = createSupabaseClient(env);
      expect(client).toBeDefined();
    });
    
    it('should throw error for missing URL', () => {
      const env = { SUPABASE_SERVICE_ROLE_KEY: 'test-key' };
      
      expect(() => createSupabaseClient(env)).toThrow('SUPABASE_URL is required');
    });
    
    it('should throw error for missing service key', () => {
      const env = { SUPABASE_URL: 'https://test.supabase.co' };
      
      expect(() => createSupabaseClient(env)).toThrow('SUPABASE_SERVICE_ROLE_KEY is required');
    });
  });
  
  describe('executeQuery', () => {
    it('should execute query successfully', async () => {
      const mockResult = { data: [{ id: 1 }], error: null };
      const queryFn = vi.fn().mockResolvedValue(mockResult);
      
      const result = await executeQuery(mockSupabaseClient, queryFn);
      
      expect(queryFn).toHaveBeenCalledWith(mockSupabaseClient);
      expect(result).toEqual(mockResult);
    });
    
    it('should throw error when query fails', async () => {
      const mockResult = { data: null, error: { message: 'Query failed' } };
      const queryFn = vi.fn().mockResolvedValue(mockResult);
      
      await expect(executeQuery(mockSupabaseClient, queryFn))
        .rejects.toThrow('Database error: Query failed');
    });
    
    it('should handle thrown exceptions', async () => {
      const queryFn = vi.fn().mockRejectedValue(new Error('Connection failed'));
      
      await expect(executeQuery(mockSupabaseClient, queryFn))
        .rejects.toThrow('Connection failed');
    });
  });
});

describe('Database Queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  describe('getBooks', () => {
    it('should get books with default options', async () => {
      const mockResult = { 
        data: [{ id: '1', title: 'Test Book' }], 
        count: 1,
        error: null 
      };
      
      const queryMock = createMockQuery(mockResult);
      mockSupabaseClient.from.mockReturnValue(queryMock);
      
      const result = await getBooks(mockSupabaseClient);
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('books_with_categories');
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        pages: 1
      });
    });
    
    it('should apply category filter', async () => {
      const mockResult = { data: [], count: 0, error: null };
      const queryMock = createMockQuery(mockResult);
      mockSupabaseClient.from.mockReturnValue(queryMock);
      
      await getBooks(mockSupabaseClient, { category: 'fiction' });
      
      expect(queryMock.contains).toHaveBeenCalledWith('categories', ['fiction']);
    });
    
    it('should apply search filter', async () => {
      const mockResult = { data: [], count: 0, error: null };
      const queryMock = createMockQuery(mockResult);
      mockSupabaseClient.from.mockReturnValue(queryMock);
      
      await getBooks(mockSupabaseClient, { search: 'test query' });
      
      expect(queryMock.textSearch).toHaveBeenCalledWith('search_vector', 'test query');
    });
  });
  
  describe('getBookBySlug', () => {
    it('should get book by slug', async () => {
      const mockResult = { 
        data: { id: '1', slug: 'test-book' }, 
        error: null 
      };
      
      const queryMock = createMockQuery(mockResult);
      mockSupabaseClient.from.mockReturnValue(queryMock);
      
      const result = await getBookBySlug(mockSupabaseClient, 'test-book');
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('books_with_categories');
      expect(queryMock.eq).toHaveBeenCalledWith('slug', 'test-book');
      expect(queryMock.single).toHaveBeenCalled();
    });
  });
  
  describe('searchBooks', () => {
    it('should search books with query', async () => {
      const mockResult = { 
        data: [{ id: '1', title: 'Matching Book' }], 
        error: null 
      };
      
      const queryMock = createMockQuery(mockResult);
      mockSupabaseClient.from.mockReturnValue(queryMock);
      
      const result = await searchBooks(mockSupabaseClient, 'test search');
      
      expect(queryMock.textSearch).toHaveBeenCalledWith('search_vector', 'test search');
      expect(queryMock.limit).toHaveBeenCalledWith(20);
    });
    
    it('should apply category filter in search', async () => {
      const mockResult = { data: [], error: null };
      const queryMock = createMockQuery(mockResult);
      mockSupabaseClient.from.mockReturnValue(queryMock);
      
      await searchBooks(mockSupabaseClient, 'test', { category: 'fiction' });
      
      expect(queryMock.contains).toHaveBeenCalledWith('categories', ['fiction']);
    });
  });
  
  describe('getCategories', () => {
    it('should get all categories', async () => {
      const mockResult = { 
        data: [{ slug: 'fiction', name: 'Fiction' }], 
        error: null 
      };
      
      const queryMock = createMockQuery(mockResult);
      mockSupabaseClient.from.mockReturnValue(queryMock);
      
      const result = await getCategories(mockSupabaseClient);
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('categories');
      expect(queryMock.order).toHaveBeenCalledWith('name');
    });
  });
  
  describe('createReview', () => {
    it('should create a review', async () => {
      const mockResult = { 
        data: { id: '1', stars: 5, body: 'Great book!' }, 
        error: null 
      };
      
      const queryMock = createMockQuery(mockResult);
      mockSupabaseClient.from.mockReturnValue(queryMock);
      
      const reviewData = {
        book_id: 'book-1',
        stars: 5,
        body: 'Great book!',
        ip_hash: 'hash123'
      };
      
      const result = await createReview(mockSupabaseClient, reviewData);
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('reviews');
      expect(queryMock.insert).toHaveBeenCalledWith({
        book_id: 'book-1',
        stars: 5,
        body: 'Great book!',
        ip_hash: 'hash123',
        approved: true
      });
    });
  });
  
  describe('checkReviewRateLimit', () => {
    it('should check rate limit for IP', async () => {
      const mockResult = { 
        data: [], 
        count: 2,
        error: null 
      };
      
      const queryMock = createMockQuery(mockResult);
      mockSupabaseClient.from.mockReturnValue(queryMock);
      
      const result = await checkReviewRateLimit(mockSupabaseClient, 'hash123');
      
      expect(result.data.count).toBe(2);
      expect(result.data.limit).toBe(5);
      expect(result.data.remaining).toBe(3);
    });
  });
});