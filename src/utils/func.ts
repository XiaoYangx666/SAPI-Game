/**获取两个setA-setB */
export function difference<T>(a: Set<T>, b: Set<T>): Set<T> {
    const result = new Set<T>();
    for (const item of a) {
        if (!b.has(item)) result.add(item);
    }
    return result;
}

/**对对象执行map方法 */
export function mapObject<T extends object, U>(
    obj: T,
    fn: (value: T[keyof T], key: keyof T) => U
): { [K in keyof T]: U } {
    return Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [
            k,
            fn(v as T[keyof T], k as keyof T),
        ])
    ) as { [K in keyof T]: U };
}
