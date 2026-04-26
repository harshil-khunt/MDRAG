# Setup Guide

## Step-by-Step Setup Instructions

### 1. Install Dependencies

```bash
# Backend
npm install

# Frontend
cd frontend
npm install
cd ..
```

### 2. Configure Environment Variables

**Backend (.env):**
```bash
# Copy example and edit
cp .env.example .env
```

Required variables:
```env
PORT=3100
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname
DB_NAME=content_db
REDIS_HOST=your-redis-host.com
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
GEMINI_API_KEY=your-gemini-api-key
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_INDEX_NAME=ai-assistant
PINECONE_ENVIRONMENT=us-east-1
```

**Frontend (frontend/.env):**
```bash
cd frontend
echo "VITE_API_URL=http://localhost:3100" > .env
cd ..
```

### 3. Test Configuration

```bash
npm run test:config
```

This will verify:
- ✅ All environment variables are set
- ✅ MongoDB connection works
- ✅ Redis connection works

### 4. Start the Application

**You need 3 terminals:**

**Terminal 1 - Backend:**
```bash
npm run dev
```
Expected output:
```
🕒 Scheduler starting...
✓ Scheduler active - will check for re-crawls every 15 minutes
🔌 Testing MongoDB connection...
✅ MongoDB connected successfully

🚀 Server running on port 3100
📍 API endpoint: http://localhost:3100

⚠️  Don't forget to start the worker in a separate terminal:
   npm run worker
```

**Terminal 2 - Worker:**
```bash
npm run worker
```
Expected output:
```
🔌 Connecting to Redis...
   Host: your-redis-host.com
   Port: 6379
✅ File worker is ready and connected to Redis
✅ Workers started successfully!
   - File worker: listening on "process-file" queue
   - URL worker: listening on "process-url" queue
   - Custom text worker: listening on "process-custom-text" queue

👀 Waiting for jobs...
```

**Terminal 3 - Frontend:**
```bash
cd frontend
npm run dev
```
Expected output:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

### 5. Verify Everything Works

1. Open browser: http://localhost:5173
2. Create a new workspace
3. Upload a file or URL
4. Check worker terminal for processing logs
5. Try chatting with the AI

---

## Common Setup Issues

### Issue: MongoDB Connection Failed

**Error:** `MongoServerError: Authentication failed`

**Solution:**
1. Check username/password in MONGODB_URI
2. Verify database user has read/write permissions
3. Check MongoDB Atlas IP whitelist (add 0.0.0.0/0 for testing)

### Issue: Redis Connection Failed

**Error:** `ECONNREFUSED` or `ETIMEDOUT`

**Solution:**
1. Verify REDIS_HOST and REDIS_PORT
2. Check REDIS_PASSWORD is correct
3. Ensure Redis instance is running and accessible

### Issue: Port Already in Use

**Error:** `EADDRINUSE: address already in use :::3100`

**Solution:**
```bash
# Windows
netstat -ano | findstr :3100
taskkill /PID <PID> /F

# Or kill all Node processes
taskkill /IM node.exe /F
```

### Issue: Worker Not Processing Jobs

**Symptoms:**
- Files uploaded but not appearing in documents
- URLs not being crawled

**Solution:**
1. Make sure worker is running: `npm run worker`
2. Check worker terminal for errors
3. Verify Redis connection in worker logs

### Issue: Frontend Can't Connect to Backend

**Error:** `ERR_CONNECTION_REFUSED` in browser console

**Solution:**
1. Verify backend is running on correct port
2. Check `frontend/.env` has correct `VITE_API_URL`
3. Restart frontend after changing .env: `cd frontend && npm run dev`

---

## Service Requirements

### MongoDB Atlas (Free Tier Available)
1. Create account: https://www.mongodb.com/cloud/atlas
2. Create cluster (M0 Free tier)
3. Create database user
4. Get connection string
5. Add to .env as MONGODB_URI

### Redis Labs (Free Tier Available)
1. Create account: https://redis.com/try-free/
2. Create database (30MB free)
3. Get host, port, and password
4. Add to .env

### Pinecone (Free Tier Available)
1. Create account: https://www.pinecone.io/
2. Create index named "ai-assistant"
3. Use dimension: 768 (for text-embedding-004)
4. Get API key
5. Add to .env

### Google Gemini API (Free Tier Available)
1. Go to: https://makersuite.google.com/app/apikey
2. Create API key
3. Add to .env as GEMINI_API_KEY

---

## Verification Checklist

Before starting development, verify:

- [ ] `npm run test:config` passes all checks
- [ ] Backend starts without errors
- [ ] Worker connects to Redis successfully
- [ ] Frontend loads at http://localhost:5173
- [ ] Can create a workspace
- [ ] Can upload a file (check worker logs)
- [ ] Can chat with AI

---

## Next Steps

Once everything is running:

1. **Create your first workspace**
2. **Upload some documents** (PDFs, text files)
3. **Add URLs** to crawl websites
4. **Create Q&A pairs** for specific questions
5. **Add custom text** for business-specific information
6. **Start chatting** with your AI assistant!

---

## Development Tips

1. **Keep all 3 terminals visible** - you'll want to see logs from all services
2. **Check worker logs** when uploads don't appear - it shows processing progress
3. **Use test:config** after changing .env - catches configuration issues early
4. **Clear browser cache** if frontend behaves strangely after updates

---

## Production Deployment

For production deployment, see:
- Docker deployment instructions in README.md
- Consider using environment-specific .env files
- Set up proper monitoring and logging
- Use secrets management for API keys
- Configure CORS for your production domain

---

## Getting Help

If you're stuck:
1. Run `npm run test:config` to check configuration
2. Check all terminal logs for error messages
3. Verify all services (MongoDB, Redis, Pinecone) are accessible
4. Make sure worker is running - it's required for processing!
