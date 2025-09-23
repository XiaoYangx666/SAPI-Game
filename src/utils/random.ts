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
}
