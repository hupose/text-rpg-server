# 支持多架构的 Node.js Alpine 镜像
FROM --platform=$TARGETPLATFORM node:18-alpine

WORKDIR /app

# 只复制必要的文件
COPY package*.json ./
RUN npm ci --only=production

COPY server.js ./
COPY game.js ./

# 创建数据目录
RUN mkdir -p /app/data/saves

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# 启动服务
CMD ["node", "server.js"]