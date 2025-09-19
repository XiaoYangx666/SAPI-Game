import { logLevel } from "./utils";

export interface SAPIGameConfigOptions {
    logLevel?: logLevel;
    /**game end指令调用 */
    onEnd?: () => void;
}

const defaultConfig: Required<SAPIGameConfigOptions> = {
    logLevel: logLevel.debug,
    onEnd: () => {},
};

export class SAPIGameConfig {
    private static _config: SAPIGameConfigOptions = {};

    /** 获取当前配置（合并默认配置和用户配置） */
    static get config(): Readonly<Required<SAPIGameConfigOptions>> {
        return { ...defaultConfig, ...this._config };
    }

    /** 更新配置（部分更新即可） */
    static update(config: SAPIGameConfigOptions): void {
        this._config = { ...this._config, ...config };
    }

    /** 重置为默认配置 */
    static reset(): void {
        this._config = {};
    }
}
