export class Duration {
    private readonly _ticks: number;

    static readonly ticksPerSecond = 20;
    static readonly ticksPerMinute = 60 * Duration.ticksPerSecond;

    constructor(ticks: number) {
        this._ticks = ticks;
    }

    /** 获取持续时间的刻数 */
    get ticks(): number {
        return this._ticks;
    }

    toSeconds() {
        return this.ticks / Duration.ticksPerSecond;
    }

    static fromSeconds(seconds: number): Duration {
        return new Duration(Math.floor(this.ticksPerSecond * seconds));
    }

    static fromMinutes(minutes: number): Duration {
        return new Duration(Math.floor(this.ticksPerMinute * minutes));
    }
}
