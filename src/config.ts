import { logLevel } from "./utils";

/** BEGame 核心配置。服务器/地图级行为由 server integration 单独配置。 */
export interface BEGameConfigOptions {
    logLevel?: logLevel;
    debugMode?: boolean;
}

const defaultConfig: Required<BEGameConfigOptions> = {
    logLevel: logLevel.debug,
    debugMode: false,
};

export class BEGameConfig {
    private static _config: BEGameConfigOptions = {};

    static get config(): Readonly<Required<BEGameConfigOptions>> {
        return { ...defaultConfig, ...this._config };
    }

    static update(config: BEGameConfigOptions): void {
        this._config = { ...this._config, ...config };
    }

    static reset(): void {
        this._config = {};
    }
}

/** @deprecated 使用 BEGameConfigOptions。 */
export type SAPIGameConfigOptions = BEGameConfigOptions;
/** @deprecated 使用 BEGameConfig。 */
export { BEGameConfig as SAPIGameConfig };
