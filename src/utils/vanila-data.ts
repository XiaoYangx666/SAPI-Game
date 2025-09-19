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

export enum EntityTypeId {
    /**玩家 */
    Player = "minecraft:player",
}
