FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

# 创建数据目录
RUN mkdir -p /app/data/saves

EXPOSE 3000

CMD ["node", "server.js"]