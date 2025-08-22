# ADR-000: Architecture and Technology Stack

## Status
Accepted

## Context
Building a private digital library with the following requirements:
- Gothic early-internet aesthetic
- Daily password gate with midnight reset (Europe/Tirane)
- Zero/near-zero cost on free tiers
- Private file storage with streaming downloads
- Book catalog with metadata, covers, and reviews
- Full-text search capability

## Decision

### Hosting & Edge
**Cloudflare Pages + Workers**
- Static UI hosted on Cloudflare Pages (free tier)
- Cloudflare Worker handles API, auth gate, and streaming downloads
- Global edge distribution for performance
- Integrated with R2 storage

### Object Storage
**Cloudflare R2**
- Private bucket for book files and covers
- S3-compatible API with zero egress costs
- Integrated with Workers for seamless streaming

### Database
**Supabase Postgres**
- Free tier with 500MB storage
- Full-text search with built-in GIN indexes
- Real-time subscriptions (future use)
- Built-in auth (unused, custom gate instead)

### Authentication
**Daily Password Gate**
- Single shared password derived from HMAC(SECRET_SEED, YYYY-MM-DD)
- Timezone: Europe/Tirane for midnight reset
- HttpOnly cookies with automatic expiry
- No individual user accounts

### Search
**Postgres Full-Text Search**
- Built-in PostgreSQL FTS with ts_vector
- GIN indexing for performance
- Server-side search to avoid exposing data
- Future: include review snippets in search

## Consequences

### Positive
- Zero vendor lock-in (standard technologies)
- Extremely low cost (free tier usage)
- High performance with edge distribution
- Simple architecture with clear separation of concerns
- Built-in security through private storage

### Negative
- Limited by free tier quotas
- Single point of failure for secret rotation
- No granular user permissions
- Search limited to basic FTS (no advanced ranking)

## Alternatives Considered

### Hosting
- **Vercel**: More expensive for static sites, less R2 integration
- **Netlify**: Limited Worker-like functionality, separate storage needed
- **Self-hosted**: Higher maintenance, cost, and complexity

### Storage
- **AWS S3**: Egress costs, more complex auth
- **Google Cloud Storage**: Similar costs, less Worker integration
- **Database BLOBs**: Size limitations, poor performance for streaming

### Database
- **PlanetScale**: MySQL, limited FTS, costly for storage
- **Railway**: PostgreSQL but more expensive
- **Local SQLite**: No remote access, limited scale

### Auth
- **Individual accounts**: Complexity, not aligned with sharing model
- **JWT tokens**: Still need central secret, more complex
- **OAuth providers**: External dependency, user friction

## Implementation Notes
- All routes protected by gate middleware
- Cookie expires exactly at Europe/Tirane midnight
- R2 objects accessed via signed URLs through Worker
- Database migrations versioned and idempotent
- FTS materialized view for performance