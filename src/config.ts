import { logLevel } from "./utils";

/** SAPIGame 核心配置。服务器/地图级行为由 server integration 单独配置。 */
export interface SAPIGameConfigOptions {
    logLevel?: logLevel;
    debugMode?: boolean;
}

const defaultConfig: Required<SAPIGameConfigOptions> = {
    logLevel: logLevel.debug,
    debugMode: false,
};

export class SAPIGameConfig {
    private static _config: SAPIGameConfigOptions = {};

    static get config(): Readonly<Required<SAPIGameConfigOptions>> {
        return { ...defaultConfig, ...this._config };
    }

    static update(config: SAPIGameConfigOptions): void {
        this._config = { ...this._config, ...config };
    }

    static reset(): void {
        this._config = {};
    }
}
