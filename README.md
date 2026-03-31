# Text RPG Server

文字 RPG 放置游戏 - 后端服务

## 技术栈

- Node.js + Express
- Socket.IO (WebSocket)
- JSON 文件存储

## 文件结构

```
server/
├── server.js          # Express + Socket.IO 服务端
├── game.js            # 游戏核心逻辑
├── package.json       # 依赖配置
├── Dockerfile         # Docker 镜像
├── docker-compose.yml # Docker Compose 配置
├── nginx.conf         # Nginx 反代配置
├── data/              # 数据目录
│   └── saves/         # 游戏存档 (JSON)
└── README.md          # 本文件
```

## API

### REST

- `GET /api/health` - 健康检查

### Socket.IO Events

| 事件 | 参数 | 说明 |
|-----|------|-----|
| `join-game` | gameId | 加入游戏房间 |
| `new-game` | {name, classType} | 新建角色 |
| `load-game` | - | 加载存档 |
| `save-game` | - | 保存游戏 |
| `add-points` | {stat, points} | 属性加点 |
| `start-battle` | - | 开始战斗 |
| `battle-round` | - | 战斗回合 |
| `auto-battle` | {autoContinue} | 自动战斗 |
| `buy-potion` | {potionType, count} | 购买药品 |
| `use-potion` | {potionType} | 使用药品 |
| `revive` | - | 复活 |
| `start-offline-farm` | {interval} | 开始离线挂机 |
| `stop-offline-farm` | - | 停止离线挂机 |

## 运行

```bash
# 安装依赖
npm install

# 启动服务
node server.js

# 默认端口
http://localhost:3000
```

## Docker

```bash
docker-compose up -d
```

## 游戏机制

- 双职业：物理（力量加成）、魔法（魔法加成）
- 属性：力量、魔法、体力、防御
- 升级获得 3 点属性点
- 金币系统：战斗奖励、升级奖励
- 药品系统：小/中/大血瓶
- 死亡惩罚：10秒复活时间

## 相关仓库

- [text-rpg-client](https://github.com/hupose/text-rpg-client) - 前端代码
- [text-rpg-server](https://github.com/hupose/text-rpg-server) - 本仓库（后端）