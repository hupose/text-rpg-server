#!/bin/bash
# 在 ARM Mac 上构建 AMD64 镜像

echo "=== 构建 AMD64 镜像 ==="

# 创建 builder（如果不存在）
docker buildx create --name multiarch 2>/dev/null || true

# 使用 builder
docker buildx use multiarch

# 构建 AMD64 镜像
docker buildx build \
    --platform linux/amd64 \
    -t text-rpg-server \
    --load \
    .

echo ""
echo "✅ 构建完成！"
echo ""
echo "导出镜像："
echo "docker save text-rpg-server > text-rpg-server-amd64.tar"
echo ""
echo "传输到服务器后加载："
echo "docker load < text-rpg-server-amd64.tar"
echo "docker run -d -p 3000:3000 -v \$(pwd)/data:/app/data --name text-rpg text-rpg-server"