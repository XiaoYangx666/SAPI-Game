import { SAPIGameConfig } from "@sapi-game/config";

export enum logLevel {
    debug = 0,
    log = 1,
    warn = 2,
    error = 3,
}

export class Logger {
    private name: string;

    constructor(name: string) {
        this.name = name;
    }

    private get logLevel() {
        return SAPIGameConfig.config.logLevel;
    }

    debug(message: string, ...optionalParams: any[]) {
        if (this.logLevel <= logLevel.debug)
            console.log(
                `[SAPI-Game][${this.name}] ${message}`,
                ...optionalParams
            );
    }

    log(message: string, ...optionalParams: any[]) {
        if (this.logLevel <= logLevel.log)
            console.log(
                `[SAPI-Game][${this.name}] ${message}`,
                ...optionalParams
            );
    }

    warn(message: string, ...optionalParams: any[]) {
        if (this.logLevel <= logLevel.warn)
            console.warn(
                `[SAPI-Game][${this.name}] ${message}`,
                ...optionalParams
            );
    }
    /**
     * 打印错误信息
     * @param message 消息
     * @param e 错误
     */
    error(message: string, e?: unknown) {
        if (this.logLevel > logLevel.error) return;
        if (e instanceof Error) {
            console.error(`[SAPI-Game][${this.name}] ${message}`, e, e.stack);
        } else {
            console.error(`[SAPI-Game][${this.name}] ${message}`, e);
        }
    }
}
