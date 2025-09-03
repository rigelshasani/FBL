# 🚀 Quick Start - Get Your Gothic Library Running in 5 Minutes

## Step 1: Create Supabase Project (2 minutes)

1. **Go to [supabase.com/dashboard](https://supabase.com/dashboard)**
2. **Click "New project"**
3. **Fill out:**
   - Organization: (choose existing or create new)
   - Name: `fbl-gothic-library`
   - Database Password: (create a strong password and save it!)
   - Region: (choose closest to you)
4. **Click "Create new project"**
5. **Wait ~2 minutes** for the project to be created

## Step 2: Get Your Credentials (30 seconds)

Once your project is ready:
1. **Go to Settings → API** (left sidebar)
2. **Copy these TWO values:**
   - **Project URL**: `https://abcdefghijk.supabase.co`
   - **Service Role Key**: `eyJhbGciOiJ...` (very long token starting with `eyJ`)

## Step 3: Update Your .env File (30 seconds)

Open `/Users/reatleat/Code/js/FBL/.env` and update these lines:

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJ...your-service-role-key...
```

## Step 4: Create Database Tables (1 minute)

1. **In Supabase dashboard, go to SQL Editor**
2. **Click "New query"**
3. **Copy ENTIRE contents** of `/Users/reatleat/Code/js/FBL/migrations/001_initial_schema.sql`
4. **Paste into SQL Editor**
5. **Click "RUN"** (takes ~30 seconds)

You should see: ✅ Success. No rows returned

## Step 5: Test Connection (30 seconds)

```bash
npm run db:test
```

Expected output:
```
🔌 Testing database connection...
✅ Connection successful!
✅ Table 'categories' exists
✅ Table 'books' exists
✅ Found 10 categories:
   - Fiction (fiction)
   - Gothic Literature (gothic)
```

## Step 6: Add Sample Books (30 seconds)

```bash
npm run db:seed
```

Expected output:
```
✓ Added Frankenstein
✓ Added Dracula  
✓ Added The Picture of Dorian Gray
✓ Added The Turn of the Screw
✓ Added The Metamorphosis
✓ Database seeding completed
```

## Step 7: Start Your Gothic Library! (10 seconds)

```bash
npm run dev
```

**Visit: http://localhost:8788**

🎉 **Your Cemetery of Forgotten Books is now live!**

## What You Can Test:

1. **Authentication**: Use today's daily password (check `/admin`)
2. **Browse Books**: See your 5 gothic classics
3. **Search**: Full-text search across all books
4. **Security**: All bulletproof security features are active
5. **Admin Panel**: Manage daily passwords

## Troubleshooting:

- **"Connection failed: JWT"** → Wrong Service Role Key
- **"relation does not exist"** → Haven't run the migration yet
- **"No books found"** → Run `npm run db:seed`

---

**Total Time: ~5 minutes**  
**Result: Fully functional gothic digital library with bulletproof security!**