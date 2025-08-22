-- FBL Gothic Library - Initial Database Schema
-- Creates books, categories, reviews tables with FTS indexing

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Books table
CREATE TABLE books (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    year INTEGER,
    language CHAR(2) DEFAULT 'en',
    summary TEXT,
    cover_key TEXT NOT NULL, -- R2 storage key for cover image
    formats JSONB NOT NULL DEFAULT '{}', -- { epub: { key, bytes, sha256 }, pdf: { key, bytes, sha256 } }
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categories table
CREATE TABLE categories (
    slug TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Book-Category junction table
CREATE TABLE book_categories (
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    category_slug TEXT REFERENCES categories(slug) ON DELETE CASCADE,
    PRIMARY KEY (book_id, category_slug)
);

-- Reviews table  
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    stars INTEGER NOT NULL CHECK (stars >= 1 AND stars <= 5),
    body TEXT NOT NULL CHECK (LENGTH(body) <= 500),
    ip_hash TEXT NOT NULL, -- SHA256(IP + daily_salt) for anti-spam
    approved BOOLEAN DEFAULT TRUE
);

-- Add tsvector column for full-text search
ALTER TABLE books ADD COLUMN search_vector TSVECTOR;

-- Create function to update search vector
CREATE OR REPLACE FUNCTION update_books_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.author, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.summary, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update search vector
CREATE TRIGGER books_search_vector_update 
    BEFORE INSERT OR UPDATE ON books 
    FOR EACH ROW 
    EXECUTE FUNCTION update_books_search_vector();

-- Create indexes for performance
CREATE INDEX idx_books_search_vector ON books USING GIN(search_vector);
CREATE INDEX idx_books_slug ON books(slug);
CREATE INDEX idx_books_created_at ON books(created_at DESC);
CREATE INDEX idx_books_year ON books(year);
CREATE INDEX idx_books_language ON books(language);

CREATE INDEX idx_reviews_book_created ON reviews(book_id, created_at DESC);
CREATE INDEX idx_reviews_approved ON reviews(approved) WHERE approved = TRUE;
CREATE INDEX idx_reviews_ip_hash ON reviews(ip_hash);

CREATE INDEX idx_book_categories_book ON book_categories(book_id);
CREATE INDEX idx_book_categories_category ON book_categories(category_slug);

-- Add updated_at trigger for books
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER books_updated_at 
    BEFORE UPDATE ON books 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert initial categories
INSERT INTO categories (slug, name, description) VALUES
('fiction', 'Fiction', 'Literary works of imagination including novels and short stories'),
('non-fiction', 'Non-Fiction', 'Factual books including biographies, history, and essays'),
('philosophy', 'Philosophy', 'Works exploring fundamental questions of existence, knowledge, and ethics'),
('classics', 'Classics', 'Timeless literary works that have stood the test of time'),
('gothic', 'Gothic Literature', 'Dark romantic literature featuring mystery, horror, and supernatural elements'),
('poetry', 'Poetry', 'Collections of poems and verse'),
('science', 'Science', 'Scientific works, research, and discoveries'),
('history', 'History', 'Historical accounts, biographies, and chronicles'),
('mysticism', 'Mysticism & Occult', 'Esoteric knowledge, spiritual practices, and mystical traditions'),
('art', 'Art & Aesthetics', 'Works on visual arts, aesthetics, and creative expression');

-- Create view for books with category information
CREATE OR REPLACE VIEW books_with_categories AS
SELECT 
    b.*,
    COALESCE(
        ARRAY_AGG(bc.category_slug ORDER BY bc.category_slug) 
        FILTER (WHERE bc.category_slug IS NOT NULL), 
        ARRAY[]::TEXT[]
    ) AS categories,
    COALESCE(
        ARRAY_AGG(c.name ORDER BY bc.category_slug) 
        FILTER (WHERE c.name IS NOT NULL), 
        ARRAY[]::TEXT[]
    ) AS category_names
FROM books b
LEFT JOIN book_categories bc ON b.id = bc.book_id
LEFT JOIN categories c ON bc.category_slug = c.slug
GROUP BY b.id;

-- Create view for book statistics
CREATE OR REPLACE VIEW book_stats AS
SELECT 
    b.id,
    b.slug,
    COUNT(r.id) AS review_count,
    ROUND(AVG(r.stars), 2) AS avg_rating,
    COUNT(r.id) FILTER (WHERE r.approved = TRUE) AS approved_review_count
FROM books b
LEFT JOIN reviews r ON b.id = r.book_id
GROUP BY b.id, b.slug;