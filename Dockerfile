# Use a lightweight Node.js image
FROM node:22-alpine as build

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY . .

# Build the application (if needed)
# RUN npm run build

# Use Nginx to serve static files
FROM nginx:alpine

# Copy built assets from build stage
COPY --from=build /app /usr/share/nginx/html

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
