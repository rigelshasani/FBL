# Database Schema Documentation

## Overview

The FBL Gothic Library uses PostgreSQL (via Supabase) with full-text search capabilities. The schema is designed for efficient book catalog management with categories, reviews, and comprehensive search functionality.

## Tables

### `books`
Core book metadata and file references.

```sql
CREATE TABLE books (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT UNIQUE NOT NULL,           -- URL-friendly identifier
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    year INTEGER,                        -- Publication year
    language CHAR(2) DEFAULT 'en',       -- ISO 639-1 language code
    summary TEXT,                        -- Book description/synopsis
    cover_key TEXT NOT NULL,             -- R2 storage key for cover image
    formats JSONB NOT NULL DEFAULT '{}', -- File formats available
    search_vector TSVECTOR,              -- Generated FTS vector
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Formats JSONB Structure:**
```json
{
  "epub": {
    "key": "books/slug/hash.epub",
    "bytes": 1234567,
    "sha256": "abc123..."
  },
  "pdf": {
    "key": "books/slug/hash.pdf", 
    "bytes": 2345678,
    "sha256": "def456..."
  }
}
```

### `categories`
Curated book categories for organization.

```sql
CREATE TABLE categories (
    slug TEXT PRIMARY KEY,               -- URL-friendly identifier
    name TEXT NOT NULL,                  -- Display name
    description TEXT,                    -- Category description
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Pre-populated Categories:**
- `fiction` - Literary works of imagination
- `non-fiction` - Factual books and essays
- `philosophy` - Philosophical works
- `classics` - Timeless literary works
- `gothic` - Gothic literature (dark romantic)
- `poetry` - Poetry collections
- `science` - Scientific works
- `history` - Historical accounts
- `mysticism` - Esoteric and mystical works
- `art` - Art and aesthetics

### `book_categories`
Many-to-many relationship between books and categories.

```sql
CREATE TABLE book_categories (
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    category_slug TEXT REFERENCES categories(slug) ON DELETE CASCADE,
    PRIMARY KEY (book_id, category_slug)
);
```

### `reviews`
Anonymous user reviews with anti-spam measures.

```sql
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    stars INTEGER NOT NULL CHECK (stars >= 1 AND stars <= 5),
    body TEXT NOT NULL CHECK (LENGTH(body) <= 500),
    ip_hash TEXT NOT NULL,               -- SHA256(IP + daily_salt)
    approved BOOLEAN DEFAULT TRUE       -- Moderation flag
);
```

**Anti-spam Features:**
- IP addresses are hashed with daily salt (no raw IPs stored)
- Rate limit: 5 reviews per IP per day
- Review body limited to 500 characters
- Moderation approval system

## Indexes

### Performance Indexes
- `idx_books_search_vector` - GIN index for full-text search
- `idx_books_slug` - Unique lookup by slug
- `idx_books_created_at` - Chronological ordering
- `idx_books_year` - Filter by publication year
- `idx_books_language` - Filter by language

### Review Indexes
- `idx_reviews_book_created` - Reviews by book, chronological
- `idx_reviews_approved` - Approved reviews only
- `idx_reviews_ip_hash` - Rate limiting by IP

### Category Indexes
- `idx_book_categories_book` - Books by category
- `idx_book_categories_category` - Categories by book

## Views

### `books_with_categories`
Denormalized view joining books with their categories.

```sql
CREATE VIEW books_with_categories AS
SELECT 
    b.*,
    COALESCE(ARRAY_AGG(bc.category_slug), ARRAY[]::TEXT[]) AS categories,
    COALESCE(ARRAY_AGG(c.name), ARRAY[]::TEXT[]) AS category_names
FROM books b
LEFT JOIN book_categories bc ON b.id = bc.book_id
LEFT JOIN categories c ON bc.category_slug = c.slug
GROUP BY b.id;
```

### `book_stats`
Aggregated statistics for each book.

```sql
CREATE VIEW book_stats AS
SELECT 
    b.id,
    b.slug,
    COUNT(r.id) AS review_count,
    ROUND(AVG(r.stars), 2) AS avg_rating,
    COUNT(r.id) FILTER (WHERE r.approved = TRUE) AS approved_review_count
FROM books b
LEFT JOIN reviews r ON b.id = r.book_id
GROUP BY b.id, b.slug;
```

## Full-Text Search

### Search Vector Generation
Books have an automatically maintained `search_vector` column that combines:
- Title (weight A - highest priority)
- Author (weight B - high priority)  
- Summary (weight C - medium priority)

### Search Query Example
```sql
SELECT * FROM books_with_categories 
WHERE search_vector @@ plainto_tsquery('english', 'gothic horror vampires')
ORDER BY ts_rank(search_vector, plainto_tsquery('english', 'gothic horror vampires')) DESC;
```

### Search Features
- English language stemming and stop words
- Weighted results (title matches rank higher)
- Category filtering in search results
- Phrase and boolean search support

## Triggers

### `books_search_vector_update`
Automatically updates the search vector when book data changes.

### `books_updated_at`
Updates the `updated_at` timestamp on book modifications.

## Migration System

### Migration Tracking
- `_migrations` table tracks applied migrations
- Sequential numbering: `001_initial_schema.sql`, `002_feature.sql`
- Idempotent migrations (safe to re-run)

### Migration Commands
```bash
npm run db:migrate   # Apply pending migrations
npm run db:seed      # Add sample data
npm run db:reset     # Migrate + seed
```

## Privacy & Security

### IP Hash System
- Raw IP addresses never stored
- Daily salt rotation: `SHA256(IP + YYYY-MM-DD + SECRET_SALT)`
- Rate limiting without user tracking

### Access Control
- Service role key for Worker access
- Row Level Security (RLS) can be enabled
- All access through authenticated Worker

### Data Retention
- Reviews retained indefinitely (approved only)
- IP hashes naturally rotate daily
- Book files stored with content-based keys (immutable)

## Performance Considerations

### Query Optimization
- Use views for complex joins
- Limit/offset pagination for large result sets
- Category filtering before FTS for efficiency

### Caching Strategy
- Worker can cache category lists (rarely change)
- Book metadata cacheable (updated_at for invalidation)
- Search results cached by query hash

### Storage Efficiency
- JSONB for flexible format metadata
- UUIDs for distributed primary keys
- Minimal denormalization (categories in view)

## Backup Strategy

### Automated Backups
- Nightly `pg_dump` to R2 storage
- Monthly cold backups to local storage
- Weekly incremental review exports

### Recovery Procedures
1. Restore from latest nightly backup
2. Re-apply migrations if needed
3. Verify data integrity
4. Rebuild search vectors if corrupted