# Frontend Dockerfile
FROM node:20.9.0-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Environment Variables for build
ENV VITE_API_URL=http://72.61.40.15:3101

# Build the app
RUN npm run build

# Production stage
FROM node:20.9.0-alpine

WORKDIR /app

# Install serve globally
RUN npm install -g serve

# Copy build from builder stage
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 3100

# Serve the built app
CMD ["serve", "-s", "dist", "-l", "3100"]
