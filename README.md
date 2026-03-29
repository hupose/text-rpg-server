# Text RPG Server

文字 RPG 放置游戏 - 后端

## 🐳 Docker 一键部署

```bash
# 克隆仓库
git clone https://github.com/hupose/text-rpg-server.git
cd text-rpg-server

# 构建并启动
docker build -t text-rpg-server .
docker run -d -p 3000:3000 -v $(pwd)/data:/app/data --name text-rpg text-rpg-server

# 检查状态
curl http://localhost:3000/api/health
```

## 📦 手动部署

```bash
# 安装依赖
npm install --production

# 启动服务
node server.js

# 后台运行 (使用 pm2)
npm install -g pm2
pm2 start server.js --name text-rpg
```

## 🔧 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| PORT | 3000 | 服务端口 |

## 📁 数据存储

- 存档位置: `./data/saves/`
- 每个 gameId 一个 JSON 文件

## 🔗 API

| 端点 | 方法 | 说明 |
|------|------|------|
| /api/health | GET | 健康检查 |
| WebSocket | - | 游戏交互 |

### WebSocket 事件

- `join-game` - 加入游戏房间
- `new-game` - 创建新角色
- `load-game` - 加载存档
- `save-game` - 保存游戏
- `start-battle` - 开始战斗
- `auto-battle` - 自动战斗
- `start-offline-farm` - 离线战斗
- `stop-offline-farm` - 停止离线战斗

## 🛠️ 技术栈

- Node.js 18
- Express
- Socket.IO
- 文件存储

## 📄 许可证

MIT