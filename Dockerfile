FROM node:22-alpine

WORKDIR /app

# Copy package files and install production deps only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application files
COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
