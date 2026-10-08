/**
 * 三国志·战略版 - 点将招募系统 (Gacha Engine)
 * 真实还原原版三战概率：5星 5.6%、4星 36.0%、3星 58.4%
 * 核心机制：5星内部划分【大核心锁卡 (12%极低权重)】与【普通橙将 (88%普橙权重)】
 * 30 抽必出 5 星大保底、5 抽必出 4 星良将小保底
 */

import {GENERALS_DATA, THREE_STAR_GENERALS} from '../data/generals.js';

export const GACHA_CONFIG = {
    goldSingleCost: 198,
    goldFiveCost: 948,
    goldTenCost: 1896,
    copperSingleCost: 300,
    copperTenCost: 2700,
    hardPityFiveStar: 30, // 广州灵犀官方正统：30抽必出5星名将大保底
    hardPityFourStar: 5,  // 广州灵犀官方正统：5抽必出4星良将小保底
    coreRateInFiveStar: 12, // 5星出货时，大核心稀有名将基础出现率为 12%
    sevenPlusOneThreshold: 7 // 🌟 官方正统“7+1”暗保底机制：连续7张普通5星后，第8张必出大核心名将
};

// 🌟 三战原版大核心名将（三皇与四大阵营顶流稀有核心锁卡）
export const CORE_FIVE_STAR_IDS = new Set([
    // 【蜀国 7位】
    'gen_liu_bei',     // 刘备 (三皇)
    'gen_zhu_ge_liang',// 诸葛亮 (蜀智核)
    'gen_guan_yu',     // 关羽 (武圣)
    'gen_zhao_yun',    // 赵云 (一身是胆)
    'gen_zhang_fei',   // 张飞 (五虎核)
    'gen_jiang_wei',   // 姜维 (麒麟弓核)
    'gen_wei_yan',     // 魏延 (瞬发核)

    // 【吴国 7位】
    'gen_sun_quan',        // 孙权 (三皇·孙十万)
    'gen_lu_xun',          // 陆逊 (都督火烧连营核)
    'gen_zhou_yu',         // 周瑜 (神火核)
    'gen_zhou_tai',        // 周泰 (吴骑/肉盾增伤核)
    'gen_tai_shi_ci',      // 太史慈 (神射双击·万金油顶级核)
    'gen_sun_shang_xiang', // 孙尚香 (弓腰姬·吴骑绝对爆发核)
    'gen_lu_su',           // 鲁肃 (济贫好施·吴枪/都督核心润滑剂)

    // 【魏国 5位】
    'gen_cao_cao',     // 曹操 (三皇·魏武帝)
    'gen_si_ma_yi',    // 司马懿 (太尉盾终极法皇核)
    'gen_zhang_liao',  // 张辽 (爆头骑斩首核)
    'gen_guo_jia',     // 郭嘉 (十胜十败·洞察免控突击发动机)
    'gen_dian_wei',    // 典韦 (古之恶来·魏盾反击核心)

    // 【群雄 6位】
    'gen_lv_bu',       // 吕布 (天下无双·单挑大核)
    'gen_zuo_ci',      // 左慈 (方仙宗师·三仙规避核)
    'gen_zhang_jiao',  // 张角 (天公将军·五雷轰顶群雄第一法王)
    'gen_yuan_shu',    // 袁术 (仲家天子·高暴击奇谋7御核)
    'gen_dong_zhuo',   // 董卓 (酒池肉林·7御倒戈轰炸核)
    'gen_jia_xu'       // 贾诩 (毒士·算无遗策混乱核)
]);

// 🌟 大核心名将内部抽取权重（真实还原三战：三皇极度难出，孙权孙十万更是万中无一）
export const CORE_GENERAL_WEIGHTS = {
    'gen_sun_quan': 10, // 孙权 (三皇·孙十万：权重仅为常规核心的 10%)
    'gen_cao_cao': 25,  // 曹操 (魏武帝：权重仅为常规核心的 25%)
    'gen_liu_bei': 25,  // 刘备 (汉昭烈帝：权重仅为常规核心的 25%)
    DEFAULT_WEIGHT: 100 // 其他 22 位常规大核心名将的基础权重
};

/**
 * 依据三战核心卡概率及正统“7+1”暗保底抽取 5 星名将
 * @param {Array} fiveStars 5星武将列表
 * @param {number} corePityCounter 连续普通5星橙卡计数 (>=7触发第8张必出核心)
 */
function pickFiveStarGeneral(fiveStars, corePityCounter = 0) {
    const coreGenerals = fiveStars.filter(g => CORE_FIVE_STAR_IDS.has(g.id));
    const normalGenerals = fiveStars.filter(g => !CORE_FIVE_STAR_IDS.has(g.id));

    // 🌟 正统“7+1”暗保底判定：连续 7 张普通橙之后，本次 100% 必定保底大核心名将
    const isSevenPlusOneTriggered = (corePityCounter >= GACHA_CONFIG.sevenPlusOneThreshold);

    // 若触发 7+1 保底，直接走核心通道；否则按基础 12% 核心概率判定
    const isCoreRoll = isSevenPlusOneTriggered || (Math.random() * 100 < GACHA_CONFIG.coreRateInFiveStar);

    let selectedGen;
    let isCore = false;

    if (isCoreRoll && coreGenerals.length > 0) {
        // 🌟 加权轮盘抽取：三皇(曹操/刘备/孙权)权重断崖式降低，孙十万更稀有
        let totalWeight = 0;
        const weightedPool = coreGenerals.map(g => {
            const weight = CORE_GENERAL_WEIGHTS[g.id] || CORE_GENERAL_WEIGHTS.DEFAULT_WEIGHT;
            totalWeight += weight;
            return { general: g, weight };
        });

        let randomRoll = Math.random() * totalWeight;
        for (const item of weightedPool) {
            if (randomRoll < item.weight) {
                selectedGen = item.general;
                break;
            }
            randomRoll -= item.weight;
        }
        if (!selectedGen) {
            selectedGen = coreGenerals[0];
        }
        isCore = true;
    } else if (normalGenerals.length > 0) {
        selectedGen = normalGenerals[Math.floor(Math.random() * normalGenerals.length)];
        isCore = false;
    } else {
        selectedGen = fiveStars[Math.floor(Math.random() * fiveStars.length)];
        isCore = CORE_FIVE_STAR_IDS.has(selectedGen.id);
    }

    return {
        ...selectedGen,
        isCore,
        isSevenPlusOneTriggered
    };
}

export function pullGeneral(poolType = 'famous', pityFiveCounter = 0, pityFourCounter = 0, corePityCounter = 0) {
    const isFamous = (poolType === 'famous');
    const fiveStars = GENERALS_DATA.filter(g => g.star === 5);
    const fourStars = GENERALS_DATA.filter(g => g.star === 4);

    // 1. 触发 5 星大保底判定 (第 30 抽必出 5 星橙卡)
    if (isFamous && pityFiveCounter >= GACHA_CONFIG.hardPityFiveStar - 1) {
        const gen = pickFiveStarGeneral(fiveStars, corePityCounter);
        return {general: gen, isFivePity: true, resetFivePity: true, resetFourPity: true, isCore: gen.isCore, resetCorePity: gen.isCore};
    }

    // 2. 触发 4 星小保底判定 (连续 4 抽未出紫橙，第 5 抽必出 4 星紫卡或 5 星橙卡)
    if (isFamous && pityFourCounter >= GACHA_CONFIG.hardPityFourStar - 1) {
        // 按 5.6% / (5.6% + 36.0%) = 13.5% 出 5 星，86.5% 出 4 星
        const isPityFive = (Math.random() * 100 < 13.5);
        if (isPityFive) {
            const gen = pickFiveStarGeneral(fiveStars, corePityCounter);
            return {general: gen, isFivePity: false, resetFivePity: true, resetFourPity: true, isCore: gen.isCore, resetCorePity: gen.isCore};
        } else {
            const gen = fourStars[Math.floor(Math.random() * fourStars.length)];
            return {
                general: {...gen, isCore: false},
                isFourPity: true,
                resetFivePity: false,
                resetFourPity: true,
                isCore: false,
                resetCorePity: false
            };
        }
    }

    const roll = Math.random() * 100;

    if (isFamous) {
        // 广州灵犀官方正统公示概率：5星 5.6%, 4星 36.0%, 3星 58.4%
        if (roll < 5.6) {
            const gen = pickFiveStarGeneral(fiveStars, corePityCounter);
            return {general: gen, isFivePity: false, resetFivePity: true, resetFourPity: true, isCore: gen.isCore, resetCorePity: gen.isCore};
        } else if (roll < 41.6) { // 5.6 + 36.0 = 41.6
            const gen = fourStars[Math.floor(Math.random() * fourStars.length)];
            return {
                general: {...gen, isCore: false},
                isFourPity: false,
                resetFivePity: false,
                resetFourPity: true,
                isCore: false,
                resetCorePity: false
            };
        } else {
            // 3星随军良将 (58.4%)
            const gen = createThreeStarGeneral();
            return {general: gen, isFivePity: false, resetFivePity: false, resetFourPity: false, isCore: false, resetCorePity: false};
        }
    } else {
        // 广州灵犀官方正统铜币良将池概率：4星 0.5% (极罕见), 3星 50.0%, 2星/杂兵 49.5%
        if (roll < 0.5) {
            const gen = fourStars[Math.floor(Math.random() * fourStars.length)];
            return {
                general: {...gen, isCore: false},
                isFivePity: false,
                resetFivePity: false,
                resetFourPity: true,
                isCore: false
            };
        } else {
            const gen = createThreeStarGeneral();
            return {general: gen, isFivePity: false, resetFivePity: false, resetFourPity: false, isCore: false};
        }
    }
}

function createThreeStarGeneral() {
    const pool = (THREE_STAR_GENERALS && THREE_STAR_GENERALS.length > 0)
        ? THREE_STAR_GENERALS
        : GENERALS_DATA.filter(g => g.star === 3);

    const template = pool[Math.floor(Math.random() * pool.length)];
    return {
        ...template,
        isCore: false
    };
}
