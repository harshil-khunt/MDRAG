# Backend Dockerfile
FROM node:20.9.0-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Create directories for volumes
RUN mkdir -p /app/tmp /app/uploads /app/storage

# Environment Variables
ENV PORT=3101
ENV MONGODB_URI=mongodb+srv://harshil2193_db_user:Harshilsk2193@file-url.vdwyrji.mongodb.net/content_db?retryWrites=true&w=majority&appName=File-URL
ENV DB_NAME=content_db
ENV REDIS_HOST=redis-11417.c14.us-east-1-2.ec2.cloud.redislabs.com
ENV REDIS_PORT=11417
ENV LOCAL_STORAGE_PATH=./uploads
ENV GEMINI_API_KEY=AIzaSyA8od6fq5eoBmw5-9aRT_OawzfUXjBGCoA
ENV EMBEDDING_MODEL=text-embedding-004
ENV LLM_MODEL=gemini-2.5-flash
ENV CHUNK_SIZE=1500
ENV CHUNK_OVERLAP=100
ENV REDIS_PASSWORD=BFmXglqvtj1r0XZ0RkKHLAPwIHJZhX3r

# Expose port
EXPOSE 3101

# Start both server and worker
CMD ["sh", "-c", "npm start & npm run worker & wait"]
