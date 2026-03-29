#!/bin/bash
# Text RPG Server - Docker 构建和部署脚本

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Text RPG Server Docker 部署 ===${NC}"

# 检测当前架构
ARCH=$(uname -m)
echo -e "${YELLOW}当前架构: ${ARCH}${NC}"

# 设置镜像名称
IMAGE_NAME="text-rpg-server"
CONTAINER_NAME="text-rpg"

# 停止并删除旧容器
echo -e "${YELLOW}停止旧容器...${NC}"
docker stop $CONTAINER_NAME 2>/dev/null
docker rm $CONTAINER_NAME 2>/dev/null

# 构建镜像（自动匹配当前架构）
echo -e "${YELLOW}构建镜像...${NC}"
docker build -t $IMAGE_NAME .

if [ $? -ne 0 ]; then
    echo -e "${RED}构建失败！${NC}"
    exit 1
fi

# 启动容器
echo -e "${YELLOW}启动容器...${NC}"
docker run -d \
    --name $CONTAINER_NAME \
    -p 3000:3000 \
    -v $(pwd)/data:/app/data \
    --restart unless-stopped \
    $IMAGE_NAME

if [ $? -ne 0 ]; then
    echo -e "${RED}启动失败！${NC}"
    exit 1
fi

# 等待启动
sleep 3

# 检查健康状态
echo -e "${YELLOW}检查服务状态...${NC}"
HEALTH=$(curl -s http://localhost:3000/api/health)

if [ -n "$HEALTH" ]; then
    echo -e "${GREEN}✅ 部署成功！${NC}"
    echo -e "${GREEN}服务地址: http://localhost:3000${NC}"
    echo -e "${GREEN}健康检查: $HEALTH${NC}"
else
    echo -e "${RED}❌ 服务未响应，请检查日志${NC}"
    docker logs $CONTAINER_NAME
fi

# 显示日志
echo -e "\n${YELLOW}最近日志:${NC}"
docker logs --tail 10 $CONTAINER_NAME