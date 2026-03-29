/**
 * Text RPG Backend Server
 * WebSocket + RESTful API
 */

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

// 导入游戏逻辑
const { CONFIG, Utils, Character, Enemy, BattleSystem, Game } = require('./game.js');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());

// 数据存储路径
const DATA_DIR = path.join(__dirname, 'data');
const SAVES_DIR = path.join(DATA_DIR, 'saves');

// 确保目录存在
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(SAVES_DIR)) fs.mkdirSync(SAVES_DIR, { recursive: true });

// 游戏实例存储（内存）
const games = new Map();

// ==================== 工具函数 ====================

function saveGameToFile(gameId, game) {
    try {
        const state = game.exportState();
        const filePath = path.join(SAVES_DIR, `${gameId}.json`);
        fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
    } catch (e) {
        console.error('Failed to save game:', e);
    }
}

function loadGameFromFile(gameId) {
    try {
        const filePath = path.join(SAVES_DIR, `${gameId}.json`);
        if (fs.existsSync(filePath)) {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const game = new Game();
            game.importState(data);
            return game;
        }
    } catch (e) {
        console.error('Failed to load game:', e);
    }
    return null;
}

function getGame(gameId) {
    if (!games.has(gameId)) {
        // 尝试从文件加载
        const loaded = loadGameFromFile(gameId);
        if (loaded) {
            games.set(gameId, loaded);
        } else {
            games.set(gameId, new Game());
        }
    }
    return games.get(gameId);
}

// ==================== Socket.IO ====================

io.on('connection', (socket) => {
    console.log(`[WS] Client connected: ${socket.id}`);
    
    let currentGameId = 'default';
    let currentGame = null;
    
    // 加入游戏房间
    socket.on('join-game', (gameId) => {
        currentGameId = gameId || 'default';
        socket.join(currentGameId);
        currentGame = getGame(currentGameId);
        
        console.log(`[WS] Client ${socket.id} joined game: ${currentGameId}`);
        
        // 发送当前状态
        socket.emit('state-update', currentGame.getState());
    });
    
    // 获取状态
    socket.on('get-state', () => {
        if (currentGame) {
            socket.emit('state-update', currentGame.getState());
        }
    });
    
    // 新游戏
    socket.on('new-game', async (data) => {
        const { name, classType } = data;
        currentGame = new Game();
        const result = currentGame.newGame(name || '勇者', classType || 'physical');
        
        if (result.success) {
            games.set(currentGameId, currentGame);
            saveGameToFile(currentGameId, currentGame);
            io.to(currentGameId).emit('state-update', currentGame.getState());
        }
        
        socket.emit('action-result', result);
    });
    
    // 加载游戏
    socket.on('load-game', () => {
        currentGame = loadGameFromFile(currentGameId);
        if (currentGame) {
            games.set(currentGameId, currentGame);
            io.to(currentGameId).emit('state-update', currentGame.getState());
            socket.emit('action-result', { success: true, message: '游戏已加载' });
        } else {
            socket.emit('action-result', { success: false, reason: 'no_save' });
        }
    });
    
    // 保存游戏
    socket.on('save-game', () => {
        if (!currentGame || currentGame.battleSystem.inBattle) {
            return socket.emit('action-result', { success: false, reason: 'in_battle' });
        }
        saveGameToFile(currentGameId, currentGame);
        socket.emit('action-result', { success: true, message: '游戏已保存' });
    });
    
    // 加点
    socket.on('add-points', (data) => {
        const { stat, points } = data;
        const result = currentGame.addPoints(stat, points || 1);
        if (result.success) {
            saveGameToFile(currentGameId, currentGame);
            io.to(currentGameId).emit('state-update', currentGame.getState());
        }
        socket.emit('action-result', result);
    });
    
    // 开始战斗
    socket.on('start-battle', () => {
        const result = currentGame.startBattle();
        io.to(currentGameId).emit('state-update', currentGame.getState());
        
        // 如果战斗开始，发送战斗日志
        if (result.success && result.enemy) {
            io.to(currentGameId).emit('battle-log', {
                type: 'battle',
                message: `遭遇敌人：${result.enemy.name} (Lv.${result.enemy.level})${result.enemy.isBoss ? ' 【BOSS】' : ''}`
            });
        }
        
        socket.emit('action-result', result);
    });
    
    // 战斗回合
    socket.on('battle-round', () => {
        const result = currentGame.battleRound();
        io.to(currentGameId).emit('state-update', currentGame.getState());
        socket.emit('action-result', result);
    });
    
    // 自动战斗
    socket.on('auto-battle', (data) => {
        const { autoContinue } = data || {};
        const result = currentGame.autoBattle(autoContinue || false);
        saveGameToFile(currentGameId, currentGame);
        io.to(currentGameId).emit('state-update', currentGame.getState());
        socket.emit('action-result', result);
    });
    
    // 购买药品
    socket.on('buy-potion', (data) => {
        const { potionType } = data;
        const result = currentGame.buyPotion(potionType);
        if (result.success) {
            saveGameToFile(currentGameId, currentGame);
            io.to(currentGameId).emit('state-update', currentGame.getState());
        }
        socket.emit('action-result', result);
    });
    
    // 使用药品
    socket.on('use-potion', (data) => {
        const { potionType } = data;
        const result = currentGame.usePotion(potionType);
        if (result.success) {
            saveGameToFile(currentGameId, currentGame);
            io.to(currentGameId).emit('state-update', currentGame.getState());
        }
        socket.emit('action-result', result);
    });
    
    // 自动使用药品
    socket.on('auto-use-potion', () => {
        const result = currentGame.autoUsePotion();
        if (result && result.success) {
            saveGameToFile(currentGameId, currentGame);
            io.to(currentGameId).emit('state-update', currentGame.getState());
            io.to(currentGameId).emit('battle-log', {
                type: 'system',
                message: `🧪 自动吃药：${result.message}`
            });
        }
        socket.emit('action-result', result || { success: false, reason: 'no_potion_needed' });
    });
    
    // 复活
    socket.on('revive', () => {
        const result = currentGame.revive();
        if (result.success) {
            saveGameToFile(currentGameId, currentGame);
            io.to(currentGameId).emit('state-update', currentGame.getState());
        }
        socket.emit('action-result', result);
    });
    
    // 离线战斗
    socket.on('start-offline-farm', (data) => {
        const { interval } = data || {};
        const result = currentGame.startOfflineFarm(interval || 10);
        socket.emit('action-result', result);
        
        // 定期保存
        if (result.success) {
            const saveInterval = setInterval(() => {
                if (!currentGame.offlineFarmTimer) {
                    clearInterval(saveInterval);
                    return;
                }
                saveGameToFile(currentGameId, currentGame);
            }, 30000); // 每30秒保存一次
        }
    });
    
    socket.on('stop-offline-farm', () => {
        const result = currentGame.stopOfflineFarm();
        if (result.success) {
            saveGameToFile(currentGameId, currentGame);
            io.to(currentGameId).emit('state-update', currentGame.getState());
        }
        socket.emit('action-result', result);
    });
    
    socket.on('get-offline-farm-status', () => {
        const status = currentGame.getOfflineFarmStatus();
        socket.emit('offline-farm-status', status);
    });
    
    // 重置游戏
    socket.on('reset-game', () => {
        games.delete(currentGameId);
        const filePath = path.join(SAVES_DIR, `${currentGameId}.json`);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        currentGame = new Game();
        games.set(currentGameId, currentGame);
        io.to(currentGameId).emit('state-update', currentGame.getState());
        socket.emit('action-result', { success: true, message: '游戏已重置' });
    });
    
    // 断开连接
    socket.on('disconnect', () => {
        console.log(`[WS] Client disconnected: ${socket.id}`);
    });
});

// ==================== REST API（兼容） ====================

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

// ==================== 启动服务器 ====================

server.listen(PORT, () => {
    console.log(`🎮 Text RPG Server running on http://localhost:${PORT}`);
    console.log(`📡 WebSocket enabled`);
    console.log(`📁 Data directory: ${DATA_DIR}`);
});