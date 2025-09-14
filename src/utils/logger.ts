export class Logger {
    private name: string;

    constructor(name: string) {
        this.name = name;
    }

    debug(message: string, ...optionalParams: any[]) {
        console.log(`[SAPI-Game][${this.name}] ${message}`, ...optionalParams);
    }

    log(message: string, ...optionalParams: any[]) {
        console.log(`[SAPI-Game][${this.name}] ${message}`, ...optionalParams);
    }

    warn(message: string, ...optionalParams: any[]) {
        console.warn(`[SAPI-Game][${this.name}] ${message}`, ...optionalParams);
    }
    /**
     * 打印错误信息
     * @param message 消息
     * @param e 错误
     */
    error(message: string, e?: unknown) {
        if (e instanceof Error) {
            console.error(`[SAPI-Game][${this.name}] ${message}`, e, e.stack);
        } else {
            console.error(`[SAPI-Game][${this.name}] ${message}`, e);
        }
    }
}
