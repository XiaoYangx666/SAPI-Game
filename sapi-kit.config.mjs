import { defineSapiKitConfig } from "sapi-kit";

export default defineSapiKitConfig({
    // === build相关 ===

    /** 是否每次构建前清空 scripts 目录(rollup输出目录)*/
    shouldClearOutput: true,
    /** 是否通过 npx 调用 tsc。建议在 tsc 无法直接调用（例如未全局安装）时启用，注意可能会降低启动速度。 */
    useNpx: false,

    // === 拷贝相关 ===

    /** 构建完成后是否自动复制行为包到游戏目录 */
    shouldCopyToGame: false,
    /** 游戏路径类型："win" 表示默认 Windows 路径，"custom" 表示自定义路径 */
    gamePathMode: "win",
    /** 自定义游戏路径（指向 development_behavior_packs 的上一级目录）
     * 仅当 gamePathMode 为 "custom" 时有效 */
    customGameRoot: "/xxx/xxx/xxx",
    /** 行为包在 development_behavior_packs 中的文件夹名称，不写则为行为包的uuid*/
    // behaviorPackFolderName: "testbp",

    // === 打包相关 ===

    /** 打包名称:xxx.mcpack(默认从 manifest.json 中读取) */
    // packageName: "test",

    /** 是否启用二次 zip 压缩(用于上传蓝奏云等平台) */
    enableExtraZip: true,

    /** 打包文件名中是否包含版本号（版本号从 manifest.json 中读取） */
    includeVersionInName: true,

    /** 是否使用逗号格式的版本号如 v1,x,x 以兼容某些玩家导入问题 */
    useCommaStyleVersion: true,
});
