/**
 * Text RPG - Core Game Logic
 * 纯文字放置 RPG 游戏核心
 * 
 * OpenClaw 集成接口：
 * - GameAPI.getState() - 查询游戏状态
 * - GameAPI.makeDecision(action, params) - 执行决策（加点、战斗等）
 */

// ==================== 游戏配置 ====================
const CONFIG = {
    // 战斗冷却时间（秒）
    BATTLE_COOLDOWN_MIN: 5,
    BATTLE_COOLDOWN_MAX: 10,
    
    // 升级所需经验公式：base * level^exponent
    EXP_BASE: 100,
    EXP_EXPONENT: 1.5,
    
    // 每级属性点
    POINTS_PER_LEVEL: 3,
    
    // 金币奖励配置
    GOLD_REWARDS: {
        normalEnemy: 10,   // 小怪：等级 × 10
        bossEnemy: 50,     // BOSS：等级 × 50
        levelUp: 100,      // 升级：等级 × 100
    },
    
    // 药品配置
    POTION_CONFIG: {
        small: { 
            name: '小血瓶', 
            cost: 20, 
            healPercent: 0.3,
            icon: '🧪'
        },
        medium: { 
            name: '中血瓶', 
            cost: 50, 
            healPercent: 0.5,
            icon: '🧪'
        },
        large: { 
            name: '大血瓶', 
            cost: 100, 
            healPercent: 0.8,
            icon: '🧪'
        },
    },
    
    // 自动药品策略
    AUTO_POTION_THRESHOLD: 0.3,  // 血量 < 30% 时自动吃药
    
    // 职业加成配置
    CLASS_BONUSES: {
        physical: {
            name: "物理",
            bonuses: {
                strength: 1.2,  // 力量加成 20%
                magic: 0.8,     // 魔法惩罚 20%
                stamina: 1.1,   // 体力加成 10%
            }
        },
        magical: {
            name: "魔法",
            bonuses: {
                strength: 0.8,
                magic: 1.2,
                stamina: 1.0,
            }
        }
    },
    
    // 属性阈值加成（达到后额外加成）
    ATTRIBUTE_THRESHOLDS: {
        strength: [10, 20, 30, 50, 100],
        magic: [10, 20, 30, 50, 100],
        stamina: [10, 20, 30, 50, 100],
        defense: [10, 20, 30, 50, 100],
    },
    
    // 存档键名
    SAVE_KEY: 'textRPG_save_v1',
    
    // 死亡复活时间（秒）
    DEATH_REVIVE_TIME: 10,
    
    // 状态文件路径（OpenClaw 可读取）
    STATE_FILE: 'game_state.json'
};

// ==================== 工具函数 ====================
const Utils = {
    random(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },
    
    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    },
    
    now() {
        return Date.now();
    },
    
    formatTime(ms) {
        const seconds = Math.floor(ms / 1000);
        return `${seconds}s`;
    }
};

// ==================== 角色系统 ====================
class Character {
    constructor(name, classType) {
        this.name = name;
        this.classType = classType; // 'physical' or 'magical'
        this.level = 1;
        this.exp = 0;
        this.expToNext = this.calcExpToNext(1);
        this.unusedPoints = 0;
        
        // 基础属性（不含加成）- A方案：提高初始血量
        this.baseStats = {
            strength: 5,
            magic: 5,
            stamina: 20,  // 从10提高到20，血量翻倍
            defense: 5,
        };
        
        // D方案：初始金币和药品
        this.gold = 100;  // 初始100金币
        this.potions = {
            small: 3,   // 初始3个小血瓶
            medium: 1,  // 初始1个中血瓶
            large: 0,
        };
        
        // 战斗状态
        this.currentHp = this.getMaxHp();
        this.hpRegen = this.getHpRegen();
        
        // 死亡状态
        this.isDead = false;
        this.deathTime = null;
        this.reviveTime = null;
    }
    
    // 检查是否可以复活
    canRevive() {
        if (!this.isDead) return true;
        if (!this.reviveTime) return false;
        return Utils.now() >= this.reviveTime;
    }
    
    // 获取复活剩余时间（毫秒）
    getReviveRemaining() {
        if (!this.isDead || !this.reviveTime) return 0;
        return Math.max(0, this.reviveTime - Utils.now());
    }
    
    // 死亡
    die() {
        this.isDead = true;
        this.currentHp = 0;
        this.deathTime = Utils.now();
        this.reviveTime = Utils.now() + CONFIG.DEATH_REVIVE_TIME * 1000;
    }
    
    // 复活
    revive() {
        this.isDead = false;
        this.currentHp = this.getMaxHp();
        this.deathTime = null;
        this.reviveTime = null;
    }
    
    getClassBonus(statName) {
        const classConfig = CONFIG.CLASS_BONUSES[this.classType];
        return classConfig.bonuses[statName] || 1.0;
    }
    
    getThresholdBonus(statName, value) {
        const thresholds = CONFIG.ATTRIBUTE_THRESHOLDS[statName];
        if (!thresholds) return 0;
        
        let bonus = 0;
        for (const threshold of thresholds) {
            if (value >= threshold) {
                bonus += 2; // 每个阈值 +2 点
            }
        }
        return bonus;
    }
    
    getStat(statName) {
        const base = this.baseStats[statName] || 0;
        const classBonus = this.getClassBonus(statName);
        const thresholdBonus = this.getThresholdBonus(statName, base);
        
        return Math.floor(base * classBonus + thresholdBonus);
    }
    
    getStrength() { return this.getStat('strength'); }
    getMagic() { return this.getStat('magic'); }
    getStamina() { return this.getStat('stamina'); }
    getDefense() { return this.getStat('defense'); }
    
    getMaxHp() {
        return 100 + this.getStamina() * 10;
    }
    
    getHpRegen() {
        // B方案：加快回血速度，基础5点 + stamina加成
        return 5 + Math.floor(this.getStamina() * 0.3);
    }
    
    getAttackPower() {
        // 物理职业：力量主导；魔法职业：魔法主导
        if (this.classType === 'physical') {
            return this.getStrength() * 2 + this.getMagic();
        } else {
            return this.getMagic() * 2 + this.getStrength();
        }
    }
    
    addPoints(statName, points) {
        if (points > this.unusedPoints || points < 0) return false;
        if (!this.baseStats.hasOwnProperty(statName)) return false;
        
        this.baseStats[statName] += points;
        this.unusedPoints -= points;
        
        // 重新计算当前血量（升级后最大血量变化）
        const newMaxHp = this.getMaxHp();
        if (this.currentHp > newMaxHp) {
            this.currentHp = newMaxHp;
        }
        
        return true;
    }
    
    gainExp(amount) {
        this.exp += amount;
        let leveledUp = false;
        
        while (this.exp >= this.expToNext) {
            this.levelUp();
            leveledUp = true;
        }
        
        return leveledUp;
    }
    
    levelUp() {
        this.exp -= this.expToNext;
        this.level++;
        this.expToNext = this.calcExpToNext(this.level);
        this.unusedPoints += CONFIG.POINTS_PER_LEVEL;
        
        // 升级金币奖励
        const goldReward = this.level * CONFIG.GOLD_REWARDS.levelUp;
        this.gold += goldReward;
        
        // 回满血
        this.currentHp = this.getMaxHp();
        
        return { level: this.level, goldGained: goldReward };
    }
    
    calcExpToNext(level) {
        return Math.floor(CONFIG.EXP_BASE * Math.pow(level, CONFIG.EXP_EXPONENT));
    }
    
    regenHp(amount) {
        const oldHp = this.currentHp;
        this.currentHp = Math.min(this.currentHp + amount, this.getMaxHp());
        return this.currentHp - oldHp;
    }
    
    takeDamage(amount) {
        // 防御减免
        const defense = this.getDefense();
        const actualDamage = Math.max(1, amount - defense);
        
        this.currentHp -= actualDamage;
        return actualDamage;
    }
    
    isAlive() {
        return this.currentHp > 0;
    }
    
    heal() {
        this.currentHp = this.getMaxHp();
    }
    
    // 导出为纯 JSON 对象
    toJSON() {
        return {
            name: this.name,
            classType: this.classType,
            level: this.level,
            exp: this.exp,
            expToNext: this.expToNext,
            unusedPoints: this.unusedPoints,
            baseStats: { ...this.baseStats },
            currentHp: this.currentHp,
            maxHp: this.getMaxHp(),
            hpRegen: this.getHpRegen(),
            // 金币和药品
            gold: this.gold,
            potions: { ...this.potions },
            // 死亡状态
            isDead: this.isDead,
            deathTime: this.deathTime,
            reviveTime: this.reviveTime,
            reviveRemaining: this.getReviveRemaining(),
            // 计算属性（只读）
            strength: this.getStrength(),
            magic: this.getMagic(),
            stamina: this.getStamina(),
            defense: this.getDefense(),
            attackPower: this.getAttackPower(),
        };
    }
    
    // 从 JSON 对象加载
    static fromJSON(data) {
        const char = new Character(data.name, data.classType);
        char.level = data.level;
        char.exp = data.exp;
        char.expToNext = data.expToNext;
        char.unusedPoints = data.unusedPoints;
        char.baseStats = { ...data.baseStats };
        char.currentHp = data.currentHp;
        // 金币和药品（兼容旧存档）
        char.gold = data.gold || 0;
        char.potions = data.potions || { small: 0, medium: 0, large: 0 };
        // 死亡状态（兼容旧存档）
        char.isDead = data.isDead || false;
        char.deathTime = data.deathTime || null;
        char.reviveTime = data.reviveTime || null;
        return char;
    }
}

// ==================== 敌人系统 ====================
class Enemy {
    constructor(playerLevel) {
        this.isBoss = Math.random() < 0.1; // 10% 概率遇到 BOSS
        this.level = this.isBoss 
            ? Math.max(1, playerLevel + Utils.random(0, 2))
            : Math.max(1, playerLevel + Utils.random(-1, 1));
        
        this.classType = Math.random() < 0.5 ? 'physical' : 'magical';
        this.name = this.generateName();
        
        // 敌人属性（比玩家稍弱）
        const multiplier = this.isBoss ? 1.5 : 0.9;
        this.baseStats = {
            strength: Math.floor((5 + this.level * 2) * multiplier),
            magic: Math.floor((5 + this.level * 2) * multiplier),
            stamina: Math.floor((10 + this.level * 3) * multiplier),
            defense: Math.floor((5 + this.level * 1.5) * multiplier),
        };
        
        this.maxHp = this.calcMaxHp();
        this.currentHp = this.maxHp;
    }
    
    generateName() {
        const prefixes = this.isBoss ? ['魔王', '远古', '黑暗', '深渊', '终极'] : ['小', '普通', '野生', '流浪', '疯狂'];
        const suffixes = this.classType === 'physical' 
            ? ['战士', '剑士', '狂战', '武者', '佣兵']
            : ['法师', '术士', '巫师', '元素使', '祭司'];
        
        return prefixes[Utils.random(0, prefixes.length - 1)] + 
               suffixes[Utils.random(0, suffixes.length - 1)];
    }
    
    getStat(statName) {
        return this.baseStats[statName] || 0;
    }
    
    calcMaxHp() {
        return 100 + this.getStat('stamina') * 10;
    }
    
    getAttackPower() {
        if (this.classType === 'physical') {
            return this.getStat('strength') * 2 + this.getStat('magic');
        } else {
            return this.getStat('magic') * 2 + this.getStat('strength');
        }
    }
    
    takeDamage(amount) {
        const defense = this.getStat('defense');
        const actualDamage = Math.max(1, amount - defense);
        this.currentHp -= actualDamage;
        return actualDamage;
    }
    
    isAlive() {
        return this.currentHp > 0;
    }
    
    toJSON() {
        return {
            name: this.name,
            isBoss: this.isBoss,
            level: this.level,
            classType: this.classType,
            currentHp: this.currentHp,
            maxHp: this.maxHp,
            attackPower: this.getAttackPower(),
            defense: this.getStat('defense'),
        };
    }
}

// ==================== 战斗系统 ====================
class BattleSystem {
    constructor(game) {
        this.game = game;
        this.inBattle = false;
        this.currentEnemy = null;
        this.battleLog = [];
        this.lastBattleTime = 0;
        this.battleCount = 0;
        this.winCount = 0;
        this.loseCount = 0;
    }
    
    canStartBattle() {
        if (this.inBattle) return false;
        if (!this.game.player.isAlive()) return false;
        
        // 检查死亡状态
        if (this.game.player.isDead && !this.game.player.canRevive()) {
            return false;
        }
        
        const cooldownMs = (this.lastBattleTime === 0) ? 0 : 
            (CONFIG.BATTLE_COOLDOWN_MIN * 1000);
        return Utils.now() - this.lastBattleTime >= cooldownMs;
    }
    
    getCooldownRemaining() {
        if (this.inBattle) return 0;
        const elapsed = Utils.now() - this.lastBattleTime;
        const minCooldown = CONFIG.BATTLE_COOLDOWN_MIN * 1000;
        return Math.max(0, minCooldown - elapsed);
    }
    
    startBattle() {
        if (!this.canStartBattle()) {
            return { success: false, reason: 'cooldown' };
        }
        
        this.inBattle = true;
        this.currentEnemy = new Enemy(this.game.player.level);
        this.battleLog = [];
        this.lastBattleTime = Utils.now();
        this.battleCount++;
        
        this.log(`⚔️ 遭遇敌人：${this.currentEnemy.name} (Lv.${this.currentEnemy.level}) ${this.currentEnemy.isBoss ? '【BOSS】' : ''}`);
        
        return { success: true, enemy: this.currentEnemy.toJSON() };
    }
    
    log(message) {
        this.battleLog.push({
            time: Utils.now(),
            message: message
        });
        // 通知 UI 更新
        if (this.game.onBattleLog) {
            this.game.onBattleLog(message);
        }
    }
    
    // 执行一轮攻击
    attack(attacker, defender, isPlayer) {
        const attackPower = attacker.getAttackPower ? attacker.getAttackPower() : attacker.attackPower;
        const damage = defender.takeDamage(attackPower);
        
        const attackerName = isPlayer ? '你' : attacker.name;
        const defenderName = isPlayer ? defender.name : '你';
        
        // 正确获取 maxHp（玩家用方法，敌人用属性）
        const defenderMaxHp = defender.getMaxHp ? defender.getMaxHp() : defender.maxHp;
        
        this.log(`${attackerName} 攻击 ${defenderName}，造成 ${damage} 点伤害（${defenderName} HP: ${defender.currentHp}/${defenderMaxHp}）`);
        
        return damage;
    }
    
    // 执行一次战斗回合（玩家攻击 + 敌人反击）
    battleRound() {
        if (!this.inBattle || !this.currentEnemy) {
            return { success: false, reason: 'no_battle' };
        }
        
        const player = this.game.player;
        const enemy = this.currentEnemy;
        
        // 玩家先手
        this.attack(player, enemy, true);
        
        if (!enemy.isAlive()) {
            this.endBattle(true);
            return { success: true, result: 'win' };
        }
        
        // 敌人反击
        this.attack(enemy, player, false);
        
        if (!player.isAlive()) {
            this.endBattle(false);
            return { success: true, result: 'lose' };
        }
        
        return { success: true, result: 'ongoing' };
    }
    
    // 自动战斗直到结束
    autoBattle(autoContinue = false) {
        if (!this.inBattle && !autoContinue) {
            return { success: false, reason: 'no_battle' };
        }
        
        const rounds = [];
        let maxRounds = 100; // 防止死循环
        
        while (this.inBattle && maxRounds > 0) {
            const result = this.battleRound();
            rounds.push(result);
            maxRounds--;
            
            // 添加回血效果
            if (this.inBattle) {
                const regen = this.game.player.regenHp(this.game.player.hpRegen);
                if (regen > 0) {
                    this.log(`💚 你恢复了 ${regen} 点生命值`);
                }
            }
        }
        
        // 自动刷怪模式：战斗结束后自动开始下一场
        if (autoContinue && !this.inBattle && this.game.player.currentHp > 0) {
            const nextBattle = this.game.startBattle();
            if (nextBattle.success) {
                this.log(`🔄 自动继续下一场战斗...`);
                return this.autoBattle(true); // 递归继续
            }
        }
        
        return { success: true, rounds: rounds.length };
    }
    
    endBattle(playerWin) {
        this.inBattle = false;
        
        if (playerWin) {
            this.winCount++;
            const expReward = this.currentEnemy.isBoss ? 
                Math.floor(this.currentEnemy.level * 50) : 
                Math.floor(this.currentEnemy.level * 20);
            
            // 金币奖励
            const goldReward = this.currentEnemy.isBoss ?
                Math.floor(this.currentEnemy.level * CONFIG.GOLD_REWARDS.bossEnemy) :
                Math.floor(this.currentEnemy.level * CONFIG.GOLD_REWARDS.normalEnemy);
            this.game.player.gold += goldReward;
            
            this.log(`🎉 战斗胜利！获得 ${expReward} 经验 + ${goldReward} 金币`);
            const levelUpResult = this.game.player.gainExp(expReward);
            
            // 如果升级了，显示升级信息
            if (levelUpResult && levelUpResult.goldGained) {
                this.log(`⬆️ 升级！Lv.${levelUpResult.level} 获得 ${levelUpResult.goldGained} 金币`);
            }
            
            // 通知 UI
            if (this.game.onBattleEnd) {
                this.game.onBattleEnd('win', expReward, goldReward);
            }
        } else {
            this.loseCount++;
            this.log(`💀 战斗失败！你被击败了...`);
            this.log(`⏳ 需要等待 ${CONFIG.DEATH_REVIVE_TIME} 秒才能复活`);
            this.game.player.die(); // 设置死亡状态
            
            if (this.game.onBattleEnd) {
                this.game.onBattleEnd('lose', 0, 0);
            }
        }
        
        const enemy = this.currentEnemy;
        this.currentEnemy = null;
        
        return {
            win: playerWin,
            expGained: playerWin ? Math.floor(enemy.level * (enemy.isBoss ? 50 : 20)) : 0,
            goldGained: playerWin ? Math.floor(enemy.level * (enemy.isBoss ? CONFIG.GOLD_REWARDS.bossEnemy : CONFIG.GOLD_REWARDS.normalEnemy)) : 0,
            enemy: enemy.toJSON()
        };
    }
    
    getStats() {
        return {
            inBattle: this.inBattle,
            battleCount: this.battleCount,
            winCount: this.winCount,
            loseCount: this.loseCount,
            winRate: this.battleCount > 0 ? 
                Math.round((this.winCount / this.battleCount) * 100) : 0,
            cooldownRemaining: this.getCooldownRemaining(),
        };
    }
    
    toJSON() {
        return {
            ...this.getStats(),
            currentEnemy: this.currentEnemy ? this.currentEnemy.toJSON() : null,
            recentLogs: this.battleLog.slice(-10).map(l => l.message)
        };
    }
}

// ==================== 游戏主类 ====================
class Game {
    constructor() {
        this.player = null;
        this.battleSystem = new BattleSystem(this);
        this.gameStartTime = null;
        this.lastSaveTime = null;
        this.totalPlayTime = 0;
        
        // UI 回调
        this.onBattleLog = null;
        this.onBattleEnd = null;
        this.onStateChange = null;
    }
    
    // 初始化新游戏
    newGame(playerName, classType) {
        if (!['physical', 'magical'].includes(classType)) {
            throw new Error('Invalid class type. Choose "physical" or "magical"');
        }
        
        this.player = new Character(playerName, classType);
        this.gameStartTime = Utils.now();
        this.lastSaveTime = Utils.now();
        this.totalPlayTime = 0;
        
        this.notifyStateChange();
        
        return {
            success: true,
            message: `欢迎来到文字 RPG！你选择了${CONFIG.CLASS_BONUSES[classType].name}职业。`,
            player: this.player.toJSON()
        };
    }
    
    // 加点
    addPoints(statName, points) {
        if (!this.player) {
            return { success: false, reason: 'no_player' };
        }
        
        if (this.player.unusedPoints < points) {
            return { 
                success: false, 
                reason: 'not_enough_points',
                available: this.player.unusedPoints,
                requested: points
            };
        }
        
        const success = this.player.addPoints(statName, points);
        if (success) {
            this.notifyStateChange();
            return {
                success: true,
                message: `${statName} +${points}`,
                player: this.player.toJSON()
            };
        }
        
        return { success: false, reason: 'invalid_stat' };
    }
    
    // 开始战斗
    startBattle() {
        return this.battleSystem.startBattle();
    }
    
    // 战斗回合
    battleRound() {
        return this.battleSystem.battleRound();
    }
    
    // 自动战斗
    autoBattle(autoContinue = false) {
        return this.battleSystem.autoBattle(autoContinue);
    }
    
    // 购买药品
    buyPotion(potionType) {
        if (!this.player) {
            return { success: false, reason: 'no_player' };
        }
        
        const potion = CONFIG.POTION_CONFIG[potionType];
        if (!potion) {
            return { success: false, reason: 'invalid_potion_type' };
        }
        
        if (this.player.gold < potion.cost) {
            return { 
                success: false, 
                reason: 'not_enough_gold',
                required: potion.cost,
                current: this.player.gold
            };
        }
        
        this.player.gold -= potion.cost;
        this.player.potions[potionType]++;
        this.notifyStateChange();
        
        return {
            success: true,
            message: `购买了 ${potion.icon} ${potion.name}`,
            goldRemaining: this.player.gold,
            potionCount: this.player.potions[potionType]
        };
    }
    
    // 使用药品
    usePotion(potionType) {
        if (!this.player) {
            return { success: false, reason: 'no_player' };
        }
        
        const potion = CONFIG.POTION_CONFIG[potionType];
        if (!potion) {
            return { success: false, reason: 'invalid_potion_type' };
        }
        
        if (this.player.potions[potionType] <= 0) {
            return { success: false, reason: 'no_potion', potionType };
        }
        
        this.player.potions[potionType]--;
        const healAmount = Math.floor(this.player.getMaxHp() * potion.healPercent);
        this.player.currentHp = Math.min(this.player.currentHp + healAmount, this.player.getMaxHp());
        this.notifyStateChange();
        
        return {
            success: true,
            message: `使用了 ${potion.icon} ${potion.name}，恢复 ${healAmount} 血量`,
            healAmount,
            currentHp: this.player.currentHp,
            potionRemaining: this.player.potions[potionType]
        };
    }
    
    // 自动使用药品（精细化逻辑 + fallback）
    autoUsePotion() {
        if (!this.player) return null;
        
        // 已死亡，不能吃药
        if (this.player.isDead) return null;
        
        const hpPercent = this.player.currentHp / this.player.getMaxHp();
        
        // 血量 > 70%，不需要吃药
        if (hpPercent > 0.7) {
            return null;
        }
        
        // 根据血量选择药品类型
        let preferredType = null;
        if (hpPercent <= 0.3) {
            preferredType = 'large';  // 血量 ≤30% → 首选大血瓶
        } else if (hpPercent <= 0.5) {
            preferredType = 'medium'; // 血量 ≤50% >30% → 首选中血瓶
        } else if (hpPercent <= 0.7) {
            preferredType = 'small';  // 血量 ≤70% >50% → 首选小血瓶
        }
        
        // Fallback 逻辑：没有首选药品，尝试更小的（节省药品）
        // 特例：小血瓶没有时可以升级（血量高，浪费一点无所谓）
        const fallbackOrder = {
            large: ['large', 'medium', 'small'],  // 大血瓶没有 → 中血瓶 → 小血瓶
            medium: ['medium', 'small'],          // 中血瓶没有 → 小血瓶（不要浪费大血瓶）
            small: ['small', 'medium', 'large']   // 小血瓶没有 → 中血瓶 → 大血瓶
        };
        
        const tryOrder = fallbackOrder[preferredType] || ['large', 'medium', 'small'];
        
        for (const type of tryOrder) {
            if (this.player.potions[type] > 0) {
                const result = this.usePotion(type);
                if (result.success) {
                    // 如果使用了 fallback 药品，提示一下
                    if (type !== preferredType) {
                        result.message += `（首选 ${CONFIG.POTION_CONFIG[preferredType].name} 无库存，使用 ${CONFIG.POTION_CONFIG[type].name}）`;
                    }
                    return result;
                }
            }
        }
        
        return null; // 没有药品可用
    }
    
    // 复活
    revive() {
        if (!this.player) {
            return { success: false, reason: 'no_player' };
        }
        
        if (!this.player.isDead) {
            return { success: false, reason: 'not_dead' };
        }
        
        if (!this.player.canRevive()) {
            return {
                success: false,
                reason: 'revive_not_ready',
                remainingMs: this.player.getReviveRemaining()
            };
        }
        
        this.player.revive();
        this.notifyStateChange();
        
        return { success: true, message: '你已复活！血量已恢复。' };
    }
    
    // 保存游戏
    save() {
        if (this.battleSystem.inBattle) {
            return { success: false, reason: 'in_battle' };
        }
        
        try {
            const saveData = this.exportState();
            localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify(saveData));
            this.lastSaveTime = Utils.now();
            
            // 同时写入文件（OpenClaw 可读取）
            this.writeStateFile(saveData);
            
            return { success: true, message: '游戏已保存' };
        } catch (e) {
            return { success: false, reason: 'save_error', error: e.message };
        }
    }
    
    // 加载游戏
    load() {
        try {
            const saveData = localStorage.getItem(CONFIG.SAVE_KEY);
            if (!saveData) {
                return { success: false, reason: 'no_save' };
            }
            
            this.importState(JSON.parse(saveData));
            return { success: true, message: '游戏已加载', player: this.player.toJSON() };
        } catch (e) {
            return { success: false, reason: 'load_error', error: e.message };
        }
    }
    
    // 导出游戏状态（用于存档和 OpenClaw 读取）
    exportState() {
        return {
            version: 1,
            timestamp: Utils.now(),
            player: this.player ? this.player.toJSON() : null,
            battleSystem: this.battleSystem.toJSON(),
            gameStartTime: this.gameStartTime,
            lastSaveTime: this.lastSaveTime,
            totalPlayTime: this.totalPlayTime + (this.gameStartTime ? Utils.now() - this.gameStartTime : 0)
        };
    }
    
    // 导入游戏状态
    importState(data) {
        this.gameStartTime = data.gameStartTime;
        this.lastSaveTime = data.lastSaveTime;
        this.totalPlayTime = data.totalPlayTime || 0;
        
        if (data.player) {
            this.player = Character.fromJSON(data.player);
        }
        
        if (data.battleSystem) {
            this.battleSystem.battleCount = data.battleSystem.battleCount || 0;
            this.battleSystem.winCount = data.battleSystem.winCount || 0;
            this.battleSystem.loseCount = data.battleSystem.loseCount || 0;
        }
        
        this.notifyStateChange();
    }
    
    // 写入状态文件（OpenClaw 可读）
    writeStateFile(state) {
        // 在浏览器环境中，这可以通过下载或 IndexedDB 实现
        // 在 Node.js 环境中，可以直接写文件
        console.log('[Game] State file updated:', state);
        
        // 触发回调通知 OpenClaw
        if (window && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('game-state-update', { detail: state }));
        }
    }
    
    // 获取完整状态（OpenClaw 查询接口）
    getState() {
        return {
            player: this.player ? this.player.toJSON() : null,
            battle: this.battleSystem.toJSON(),
            gameInfo: {
                startTime: this.gameStartTime,
                lastSaveTime: this.lastSaveTime,
                totalPlayTime: this.totalPlayTime,
                canSave: !this.battleSystem.inBattle
            }
        };
    }
    
    notifyStateChange() {
        if (this.onStateChange) {
            this.onStateChange(this.getState());
        }
    }
    
    // ==================== 离线战斗系统 ====================
    
    // 开始离线战斗
    startOfflineFarm(intervalSeconds = 10) {
        if (!this.player) {
            return { success: false, reason: 'no_player' };
        }
        
        if (this.offlineFarmTimer) {
            return { success: false, reason: 'already_farming' };
        }
        
        if (this.player.isDead) {
            return { success: false, reason: 'player_dead' };
        }
        
        // 初始化离线战斗统计
        this.offlineFarmStats = {
            startTime: Utils.now(),
            battles: 0,
            wins: 0,
            expGained: 0,
            goldGained: 0,
            potionsUsed: 0,
            interval: intervalSeconds
        };
        
        // 创建定时器
        this.offlineFarmTimer = setInterval(() => {
            this.runOfflineFarmCycle();
        }, intervalSeconds * 1000);
        
        // 立即执行一次
        this.runOfflineFarmCycle();
        
        return {
            success: true,
            message: `离线战斗已启动，每 ${intervalSeconds} 秒自动战斗`,
            stats: this.offlineFarmStats
        };
    }
    
    // 停止离线战斗
    stopOfflineFarm() {
        if (!this.offlineFarmTimer) {
            return { success: false, reason: 'not_farming' };
        }
        
        clearInterval(this.offlineFarmTimer);
        this.offlineFarmTimer = null;
        
        const stats = this.offlineFarmStats;
        const duration = Utils.now() - stats.startTime;
        
        // 清空统计
        this.offlineFarmStats = null;
        
        return {
            success: true,
            message: '离线战斗已停止',
            stats: {
                ...stats,
                duration,
                durationFormatted: this.formatDuration(duration)
            }
        };
    }
    
    // 执行一次离线战斗循环
    runOfflineFarmCycle() {
        if (!this.player || this.player.isDead) {
            // 玩家死亡，检查是否可以复活
            if (this.player && this.player.canRevive()) {
                this.player.revive();
            } else {
                return; // 无法战斗
            }
        }
        
        // 自动吃药
        if (this.player.currentHp / this.player.getMaxHp() < 0.7) {
            const result = this.autoUsePotion();
            if (result && result.success) {
                this.offlineFarmStats.potionsUsed++;
            }
        }
        
        // 开始战斗
        const battleResult = this.battleSystem.startBattle();
        if (!battleResult.success) {
            return;
        }
        
        // 自动战斗
        const autoResult = this.battleSystem.autoBattle();
        
        // 更新统计
        this.offlineFarmStats.battles++;
        if (autoResult.success) {
            this.offlineFarmStats.wins++;
            this.offlineFarmStats.expGained += autoResult.expGained || 0;
            this.offlineFarmStats.goldGained += autoResult.goldGained || 0;
        }
        
        // 保存状态
        this.notifyStateChange();
    }
    
    // 获取离线战斗状态
    getOfflineFarmStatus() {
        if (!this.offlineFarmTimer) {
            return { active: false };
        }
        
        const stats = this.offlineFarmStats;
        const duration = Utils.now() - stats.startTime;
        
        return {
            active: true,
            stats: {
                ...stats,
                duration,
                durationFormatted: this.formatDuration(duration)
            }
        };
    }
    
    // 格式化时间
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}小时${minutes % 60}分`;
        } else if (minutes > 0) {
            return `${minutes}分${seconds % 60}秒`;
        } else {
            return `${seconds}秒`;
        }
    }
}

// ==================== OpenClaw API 接口 ====================
// 这是 OpenClaw 可以调用的外部接口
const GameAPI = {
    _game: null,
    
    // 获取游戏实例
    getGame() {
        if (!this._game) {
            this._game = new Game();
        }
        return this._game;
    },
    
    // 查询游戏状态
    getState() {
        const game = this.getGame();
        return game.getState();
    },
    
    // 执行决策（加点、战斗等）
    makeDecision(action, params) {
        const game = this.getGame();
        
        switch (action) {
            case 'new_game':
                return game.newGame(params.name || '勇者', params.classType || 'physical');
            
            case 'add_points':
                return game.addPoints(params.stat, params.points || 1);
            
            case 'start_battle':
                return game.startBattle();
            
            case 'battle_round':
                return game.battleRound();
            
            case 'auto_battle':
                return game.autoBattle((params && params.autoContinue) || false);
            
            case 'buy_potion':
                return game.buyPotion(params.potionType);
            
            case 'use_potion':
                return game.usePotion(params.potionType);
            
            case 'auto_use_potion':
                return game.autoUsePotion();
            
            case 'revive':
                return game.revive();
            
            case 'save':
                return game.save();
            
            case 'load':
                return game.load();
            
            default:
                return { success: false, reason: 'unknown_action', action };
        }
    },
    
    // 重置游戏
    reset() {
        this._game = new Game();
        return { success: true, message: '游戏已重置' };
    }
};

// ==================== 导出 ====================
if (typeof module !== 'undefined' && module.exports) {
    // Node.js 环境
    module.exports = {
        CONFIG,
        Utils,
        Character,
        Enemy,
        BattleSystem,
        Game,
        GameAPI
    };
} else {
    // 浏览器环境
    window.GameAPI = GameAPI;
    window.Game = Game;
    window.CONFIG = CONFIG;
}
