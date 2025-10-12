export class RandomUtils {
    /** 返回 [0, max) 的随机整数 */
    static int(max: number): number {
        return Math.floor(Math.random() * max);
    }

    /** 返回 [min, max) 的随机整数 */
    static intRange(min: number, max: number): number {
        return min + Math.floor(Math.random() * (max - min));
    }

    /** 从数组中随机取一个元素 */
    static choice<T>(arr: T[]): T | undefined {
        if (arr.length === 0) return undefined;
        return arr[this.int(arr.length)];
    }

    /** 从数组中随机取多个不重复元素(洗牌算法) */
    static choices<T>(arr: T[], count: number): T[] {
        const n = arr.length;
        if (count >= n) return [...arr];

        const copy = [...arr];

        for (let i = 0; i < count; i++) {
            const j = i + Math.floor(Math.random() * (n - i)); // 随机选择 [i, n)
            [copy[i], copy[j]] = [copy[j], copy[i]]; // 交换
        }

        return copy.slice(0, count);
    }

    /** 纯洗牌算法，返回一个新数组（Fisher–Yates Shuffle） */
    static shuffle<T>(arr: T[]): T[] {
        const copy = [...arr];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1)); // [0, i]
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }

    /** 就地洗牌（直接修改原数组） */
    static shuffleInPlace<T>(arr: T[]): void {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }

    /** 随机布尔值（true/false） */
    static bool(): boolean {
        return Math.random() < 0.5;
    }

    /** 按权重随机选择一个元素 */
    static weightedChoice<T>(arr: T[], weights: number[]): T | undefined {
        if (arr.length === 0 || arr.length !== weights.length) return undefined;
        const total = weights.reduce((a, b) => a + b, 0);
        let r = Math.random() * total;
        for (let i = 0; i < arr.length; i++) {
            if (r < weights[i]) return arr[i];
            r -= weights[i];
        }
        return arr[arr.length - 1]; // 理论上不会走到这里
    }

    /**在圆形区域内随机选点 */
    static randomPointInCircle(
        x: number,
        y: number,
        rMax: number
    ): [number, number] {
        // 随机半径，均匀分布在圆内需要用 sqrt
        const r = Math.sqrt(Math.random()) * rMax;
        // 随机角度
        const theta = Math.random() * 2 * Math.PI;
        // 计算坐标
        const xRand = x + r * Math.cos(theta);
        const yRand = y + r * Math.sin(theta);
        return [xRand, yRand];
    }
}
