FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx tsc
RUN cp -r src/db/migrations dist/db/migrations
CMD ["node", "dist/index.js"]
