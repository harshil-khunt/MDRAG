# Quick Start Guide

## 🚀 Get Running in 5 Minutes

### 1. Install Everything
```bash
npm install
cd frontend && npm install && cd ..
```

### 2. Setup Environment
```bash
# Copy and edit .env file
cp .env.example .env
# Edit .env with your credentials (MongoDB, Redis, Gemini, Pinecone)

# Create frontend .env
echo "VITE_API_URL=http://localhost:3100" > frontend/.env
```

### 3. Test Configuration
```bash
npm run test:config
```
If this passes, you're ready to go! ✅

### 4. Start Services (3 Terminals)

**Terminal 1:**
```bash
npm run dev
```

**Terminal 2:**
```bash
npm run worker
```

**Terminal 3:**
```bash
cd frontend
npm run dev
```

### 5. Open Browser
Go to: http://localhost:5173

---

## ⚠️ Troubleshooting

### Port in use?
```bash
taskkill /IM node.exe /F
```

### Can't create workspace?
- Check backend is running (Terminal 1)
- Check `frontend/.env` has `VITE_API_URL=http://localhost:3100`
- Restart frontend

### Files not processing?
- Make sure worker is running (Terminal 2)
- Check worker terminal for errors

---

## 📚 Need More Help?
- See `SETUP.md` for detailed instructions
- See `README.md` for full documentation
