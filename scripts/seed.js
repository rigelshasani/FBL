#!/usr/bin/env node

/**
 * Database seeding script
 * Adds sample books for testing and demonstration
 */

import { createSupabaseClient } from '../src/db/client.js';
import { createBook } from '../src/db/queries.js';

const SAMPLE_BOOKS = [
  {
    slug: 'frankenstein',
    title: 'Frankenstein',
    author: 'Mary Shelley',
    year: 1818,
    language: 'en',
    summary: 'A young scientist creates a creature in an unorthodox scientific experiment, exploring themes of creation, responsibility, and the nature of humanity.',
    cover_key: 'covers/frankenstein.webp',
    formats: {
      epub: { key: 'books/frankenstein/frankenstein.epub', bytes: 451234, sha256: 'abc123...' },
      pdf: { key: 'books/frankenstein/frankenstein.pdf', bytes: 1205678, sha256: 'def456...' }
    },
    categories: ['fiction', 'classics', 'gothic']
  },
  {
    slug: 'dracula',
    title: 'Dracula',
    author: 'Bram Stoker',
    year: 1897,
    language: 'en',
    summary: 'The classic vampire novel that follows the journey of Count Dracula from Transylvania to England and the ensuing battle between good and evil.',
    cover_key: 'covers/dracula.webp',
    formats: {
      epub: { key: 'books/dracula/dracula.epub', bytes: 523456, sha256: 'ghi789...' },
      pdf: { key: 'books/dracula/dracula.pdf', bytes: 1456789, sha256: 'jkl012...' }
    },
    categories: ['fiction', 'classics', 'gothic']
  },
  {
    slug: 'picture-of-dorian-gray',
    title: 'The Picture of Dorian Gray',
    author: 'Oscar Wilde',
    year: 1890,
    language: 'en',
    summary: 'A philosophical novel about a young man who sells his soul for eternal youth and beauty, while a portrait of him ages and bears the burden of his sins.',
    cover_key: 'covers/dorian-gray.webp',
    formats: {
      epub: { key: 'books/dorian-gray/dorian-gray.epub', bytes: 387654, sha256: 'mno345...' }
    },
    categories: ['fiction', 'classics', 'philosophy']
  },
  {
    slug: 'turn-of-the-screw',
    title: 'The Turn of the Screw',
    author: 'Henry James',
    year: 1898,
    language: 'en',
    summary: 'A ghost story told through the manuscript of a governess who encounters supernatural phenomena while caring for two children at a remote estate.',
    cover_key: 'covers/turn-of-the-screw.webp',
    formats: {
      epub: { key: 'books/turn-of-the-screw/turn-of-the-screw.epub', bytes: 234567, sha256: 'pqr678...' },
      pdf: { key: 'books/turn-of-the-screw/turn-of-the-screw.pdf', bytes: 678901, sha256: 'stu901...' }
    },
    categories: ['fiction', 'classics', 'gothic']
  },
  {
    slug: 'metamorphosis',
    title: 'The Metamorphosis',
    author: 'Franz Kafka',
    year: 1915,
    language: 'en',
    summary: 'A man wakes up one morning to find himself transformed into a giant insect, exploring themes of alienation, family duty, and the absurdity of existence.',
    cover_key: 'covers/metamorphosis.webp',
    formats: {
      epub: { key: 'books/metamorphosis/metamorphosis.epub', bytes: 156789, sha256: 'vwx234...' }
    },
    categories: ['fiction', 'classics']
  }
];

/**
 * Seed the database with sample books
 */
async function seed() {
  // Check environment variables
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    process.exit(1);
  }
  
  const env = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
  };
  
  console.log('Seeding database with sample books...');
  
  try {
    const supabase = createSupabaseClient(env);
    
    for (const bookData of SAMPLE_BOOKS) {
      console.log(`Adding book: ${bookData.title} by ${bookData.author}`);
      
      try {
        await createBook(supabase, bookData);
        console.log(`✓ Added ${bookData.title}`);
      } catch (error) {
        if (error.message.includes('duplicate key')) {
          console.log(`- ${bookData.title} already exists, skipping`);
        } else {
          console.error(`✗ Failed to add ${bookData.title}:`, error.message);
        }
      }
    }
    
    console.log('✓ Database seeding completed');
    
  } catch (error) {
    console.error('Seeding failed:', error.message);
    process.exit(1);
  }
}

// Run seeding if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seed();
}

export { seed };