# 🏛️ Cemetery of Forgotten Books - Database Setup

## Quick Setup (5 minutes)

### 1. Create Supabase Project
- Go to [supabase.com/dashboard](https://supabase.com/dashboard)
- Click **"New project"**
- Name: `fbl-gothic-library`
- Choose your region and set a database password
- Click **"Create new project"** (takes ~2 minutes)

### 2. Get Database Credentials
In your new Supabase project:
- Go to **Settings** → **API Keys** (in the left sidebar)
- Copy these two values:
  - **Project URL**: Found at the top of the page `https://your-project-id.supabase.co`
  - **Service Role Key**: Under "Project API keys", copy the **service_role** key (starts with `eyJhbGc...`)
  
**Note**: Don't use the anon/public key - you need the **service_role** key for full database access.

### 3. Update Your .env File
Edit `/Users/reatleat/Code/js/FBL/.env`:

```env
SECRET_SEED=demo-secret-for-testing-12345
ADMIN_SECRET_SEED=admin-secret-cfb-67890
TZ=UTC

# Replace these with your real Supabase credentials:
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=

# R2 Storage (can be empty for now)
CF_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
```

### 4. Create Database Tables
In Supabase dashboard:
- Go to **SQL Editor**
- Click **"New query"**
- Copy and paste the entire contents of `migrations/001_initial_schema.sql`
- Click **"Run"** (takes ~30 seconds)

### 5. Test Connection
```bash
npm run db:test
```

You should see:
```
🔌 Testing database connection...
✅ Connection successful!
✅ Table 'categories' exists
✅ Table 'books' exists
✅ Found 10 categories:
   - Fiction (fiction)
   - Gothic Literature (gothic)
   - Classics (classics)
```

### 6. Add Sample Books
```bash
npm run db:seed
```

You should see:
```
✓ Added Frankenstein
✓ Added Dracula  
✓ Added The Picture of Dorian Gray
✓ Added The Turn of the Screw
✓ Added The Metamorphosis
✓ Database seeding completed
```

### 7. Start the Application
```bash
npm run dev
```

Visit http://localhost:8788 and test:
1. Enter today's password (check admin panel)
2. Browse books
3. Search functionality
4. All features should work!

## Troubleshooting

### "Connection failed: JWT"
- Your Service Role Key is incorrect
- Make sure you copied the **Service Role** key, not the **anon public** key

### "relation does not exist"
- You haven't run the migration yet
- Go to Supabase SQL Editor and run `migrations/001_initial_schema.sql`

### "No books found yet"
- This is normal for a new database
- Run `npm run db:seed` to add sample gothic literature

### Database Working but App Shows Errors
- The app uses both database AND R2 storage for book files
- Database connection works, but you'll need R2 for actual book downloads
- For now, focus on getting the database connection working

## What You Get

Once connected, your gothic library will have:

📚 **5 Classic Gothic Books**:
- Frankenstein by Mary Shelley (1818)
- Dracula by Bram Stoker (1897) 
- The Picture of Dorian Gray by Oscar Wilde (1890)
- The Turn of the Screw by Henry James (1898)
- The Metamorphosis by Franz Kafka (1915)

🏷️ **10 Book Categories**:
- Fiction, Non-Fiction, Philosophy, Classics
- Gothic Literature, Poetry, Science, History  
- Mysticism & Occult, Art & Aesthetics

🔍 **Full-Text Search**: Search through titles, authors, and summaries

🛡️ **Bulletproof Security**: All the security features we just implemented

The database is production-ready with proper indexing, full-text search, and bulletproof security!