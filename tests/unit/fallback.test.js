/**
 * Tests for database fallback mechanisms
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isDatabaseAvailable,
  getFallbackCategories,
  getFallbackBooks,
  getFallbackBookBySlug,
  getFallbackSearchResults,
  getFallbackBooksByCategory,
  createOfflineResponse
} from '../../src/db/fallback.js';

describe('Database Fallback', () => {
  let mockSupabase;

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null })
    };
  });

  describe('isDatabaseAvailable', () => {
    it('should return true when database is available', async () => {
      mockSupabase.limit.mockResolvedValue({ data: [], error: null });
      
      const result = await isDatabaseAvailable(mockSupabase);
      
      expect(result).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('categories');
      expect(mockSupabase.select).toHaveBeenCalledWith('slug');
      expect(mockSupabase.limit).toHaveBeenCalledWith(1);
    });

    it('should return false when database returns error', async () => {
      mockSupabase.limit.mockResolvedValue({ 
        data: null, 
        error: { message: 'Connection failed' } 
      });
      
      const result = await isDatabaseAvailable(mockSupabase);
      
      expect(result).toBe(false);
    });

    it('should return false when database throws exception', async () => {
      mockSupabase.limit.mockRejectedValue(new Error('Network error'));
      
      const result = await isDatabaseAvailable(mockSupabase);
      
      expect(result).toBe(false);
    });

    it('should handle timeout properly', async () => {
      // Mock a slow query that takes longer than 5 seconds
      mockSupabase.limit.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 6000))
      );
      
      const result = await isDatabaseAvailable(mockSupabase);
      
      expect(result).toBe(false);
    }, 7000); // Allow extra time for timeout test
  });

  describe('getFallbackCategories', () => {
    it('should return static categories', () => {
      const result = getFallbackCategories();
      
      expect(result.data).toBeInstanceOf(Array);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0]).toHaveProperty('slug');
      expect(result.data[0]).toHaveProperty('name');
      expect(result.error).toBeNull();
    });

    it('should include gothic category', () => {
      const result = getFallbackCategories();
      const gothic = result.data.find(cat => cat.slug === 'gothic');
      
      expect(gothic).toBeDefined();
      expect(gothic.name).toBe('Gothic Literature');
    });
  });

  describe('getFallbackBooks', () => {
    it('should return books with pagination', () => {
      const result = getFallbackBooks({ page: 1, limit: 20 });
      
      expect(result.data).toBeInstanceOf(Array);
      expect(result.pagination).toHaveProperty('page', 1);
      expect(result.pagination).toHaveProperty('limit', 20);
      expect(result.pagination).toHaveProperty('total');
      expect(result.pagination).toHaveProperty('pages');
    });

    it('should filter by category', () => {
      const result = getFallbackBooks({ category: 'gothic' });
      
      result.data.forEach(book => {
        expect(book.categories).toContain('gothic');
      });
    });

    it('should filter by search query', () => {
      const result = getFallbackBooks({ search: 'frankenstein' });
      
      expect(result.data.length).toBeGreaterThan(0);
      const book = result.data.find(b => 
        b.title.toLowerCase().includes('frankenstein') || 
        b.author.toLowerCase().includes('frankenstein')
      );
      expect(book).toBeDefined();
    });

    it('should handle empty search results', () => {
      const result = getFallbackBooks({ search: 'nonexistentbook123' });
      
      expect(result.data).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });
  });

  describe('getFallbackBookBySlug', () => {
    it('should return book by slug', () => {
      const result = getFallbackBookBySlug('frankenstein-sample');
      
      expect(result.data).toBeDefined();
      expect(result.data.slug).toBe('frankenstein-sample');
      expect(result.data.title).toContain('Frankenstein');
      expect(result.error).toBeNull();
    });

    it('should return error for nonexistent book', () => {
      const result = getFallbackBookBySlug('nonexistent');
      
      expect(result.data).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error.message).toBe('Book not found');
    });
  });

  describe('getFallbackSearchResults', () => {
    it('should search books by query', () => {
      const result = getFallbackSearchResults('vampire', { limit: 10 });
      
      expect(result.data).toBeInstanceOf(Array);
      if (result.data.length > 0) {
        const book = result.data.find(b => 
          b.title.toLowerCase().includes('vampire') ||
          b.summary.toLowerCase().includes('vampire')
        );
        expect(book).toBeDefined();
      }
    });

    it('should respect limit parameter', () => {
      const result = getFallbackSearchResults('book', { limit: 1 });
      
      expect(result.data.length).toBeLessThanOrEqual(1);
    });
  });

  describe('getFallbackBooksByCategory', () => {
    it('should return books in category', () => {
      const result = getFallbackBooksByCategory('gothic', { limit: 10, offset: 0 });
      
      expect(result.data).toBeInstanceOf(Array);
      result.data.forEach(book => {
        expect(book.categories).toContain('gothic');
      });
    });

    it('should handle pagination', () => {
      const result = getFallbackBooksByCategory('fiction', { limit: 1, offset: 0 });
      
      expect(result.data.length).toBeLessThanOrEqual(1);
    });
  });

  describe('createOfflineResponse', () => {
    it('should create offline response with message', () => {
      const originalData = { data: [{ id: 1, title: 'Test' }] };
      const result = createOfflineResponse('books', originalData);
      
      expect(result.data).toEqual(originalData.data);
      expect(result.offline).toBe(true);
      expect(result.message).toContain('books');
      expect(result.message).toContain('offline');
      expect(result.limitations).toContain('reduced functionality');
    });

    it('should preserve original data structure', () => {
      const originalData = { 
        data: [], 
        pagination: { page: 1, total: 0 }
      };
      const result = createOfflineResponse('search', originalData);
      
      expect(result.data).toEqual(originalData.data);
      expect(result.pagination).toEqual(originalData.pagination);
      expect(result.offline).toBe(true);
    });
  });
});