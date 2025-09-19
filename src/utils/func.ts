/**获取两个setA-setB */
export function difference<T>(a: Set<T>, b: Set<T>): Set<T> {
    const result = new Set<T>();
    for (const item of a) {
        if (!b.has(item)) result.add(item);
    }
    return result;
}
