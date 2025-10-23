/**维度 */
export enum DimensionIds {
    Overworld = "minecraft:overworld",
    Nether = "minecraft:nether",
    End = "minecraft:the_end",
}

/** 相机视角/预设 */
export enum CameraPreset {
    /** 控制方案相机 [实验性功能: 创建者照相机] */
    ControlSchemeCamera = "minecraft:control_scheme_camera",

    /** 第一人称视角 */
    FirstPerson = "minecraft:first_person",

    /** 固定镜头视角的轨道相机 */
    FixedBoom = "minecraft:fixed_boom",

    /** 轨道相机 */
    FollowOrbit = "minecraft:follow_orbit",

    /** 自由视角 */
    Free = "minecraft:free",

    /** 第三人称视角背面 */
    ThirdPerson = "minecraft:third_person",

    /** 第三人称视角正面 */
    ThirdPersonFront = "minecraft:third_person_front",
}

export enum EntityTypeIds {
    /**玩家 */
    Player = "minecraft:player",
}

/**各种状态效果 */
export enum EffectIds {
    /** 迅捷 | speed */
    Speed = "speed",

    /** 缓慢 | slowness */
    Slowness = "slowness",

    /** 急迫 | haste */
    Haste = "haste",

    /** 挖掘疲劳 | mining_fatigue */
    MiningFatigue = "mining_fatigue",

    /** 力量 | strength */
    Strength = "strength",

    /** 瞬间治疗 | instant_health */
    InstantHealth = "instant_health",

    /** 瞬间伤害 | instant_damage */
    InstantDamage = "instant_damage",

    /** 跳跃提升 | jump_boost */
    JumpBoost = "jump_boost",

    /** 反胃 | nausea */
    Nausea = "nausea",

    /** 生命恢复 | regeneration */
    Regeneration = "regeneration",

    /** 抗性提升 | resistance */
    Resistance = "resistance",

    /** 抗火 | fire_resistance */
    FireResistance = "fire_resistance",

    /** 水下呼吸 | water_breathing */
    WaterBreathing = "water_breathing",

    /** 隐身 | invisibility */
    Invisibility = "invisibility",

    /** 失明 | blindness */
    Blindness = "blindness",

    /** 夜视 | night_vision */
    NightVision = "night_vision",

    /** 饥饿 | hunger */
    Hunger = "hunger",

    /** 虚弱 | weakness */
    Weakness = "weakness",

    /** 中毒 | poison */
    Poison = "poison",

    /** 凋零 | wither */
    Wither = "wither",

    /** 生命提升 | health_boost */
    HealthBoost = "health_boost",

    /** 伤害吸收 | absorption */
    Absorption = "absorption",

    /** 饱和 | saturation */
    Saturation = "saturation",

    /** 飘浮 | levitation */
    Levitation = "levitation",

    /** 中毒（致命） | fatal_poison */
    FatalPoison = "fatal_poison",

    /** 潮涌能量 | conduit_power */
    ConduitPower = "conduit_power",

    /** 缓降 | slow_falling */
    SlowFalling = "slow_falling",

    /** 不祥之兆 | bad_omen */
    BadOmen = "bad_omen",

    /** 村庄英雄 | village_hero */
    VillageHero = "village_hero",

    /** 黑暗 | darkness */
    Darkness = "darkness",

    /** 试炼之兆 | trial_omen */
    TrialOmen = "trial_omen",

    /** 蓄风 | wind_charged */
    WindCharged = "wind_charged",

    /** 盘丝 | weaving */
    Weaving = "weaving",

    /** 渗浆 | oozing */
    Oozing = "oozing",

    /** 寄生 | infested */
    Infested = "infested",

    /** 袭击之兆 | raid_omen */
    RaidOmen = "raid_omen",
}

/** 颜色与ID 对应表*/
export const colorIdMap = [
    "white", // 0
    "orange", // 1
    "magenta", // 2
    "light_blue", // 3
    "yellow", // 4
    "lime", // 5
    "pink", // 6
    "gray", // 7
    "light_gray", // 8
    "cyan", // 9
    "purple", // 10
    "blue", // 11
    "brown", // 12
    "green", // 13
    "red", // 14
    "black", // 15
];
