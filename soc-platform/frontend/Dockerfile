FROM node:20-alpine

WORKDIR /app

# Upgrade npm to latest
RUN npm install -g npm@latest

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
