# FBL - Gothic Digital Library

A private, early-internet-styled digital library with midnight-reset access gate.

## Architecture

- **Hosting**: Cloudflare Pages (static UI) + Cloudflare Worker (API, streaming)
- **Storage**: Cloudflare R2 (private bucket)
- **Database**: Supabase Postgres (free tier)
- **Auth**: Single shared password-of-the-day, resets at Europe/Tirane midnight

## Features

- Password-gated access with daily reset
- Book catalog with covers, metadata, and categories
- Streaming downloads with resume support
- Full-text search over books
- Anonymous reviews system (Phase 2)
- Gothic early-internet aesthetic

## Development

```bash
npm install
npm run dev          # Local development
npm run build        # Build for production
npm run test         # Run tests
npm run deploy       # Deploy to Cloudflare
```

## Environment Variables

```
SECRET_SEED=<hmac-seed-for-daily-passwords>
TZ=Europe/Tirane
CF_ACCOUNT_ID=<cloudflare-account>
R2_ACCESS_KEY_ID=<r2-access-key>
R2_SECRET_ACCESS_KEY=<r2-secret>
R2_BUCKET=<r2-bucket-name>
SUPABASE_URL=<supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<supabase-service-key>
```

## License

MIT License - see LICENSE file for details.