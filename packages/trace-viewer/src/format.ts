const TICKS_PER_SECOND = 20;

export function fmtRel(startTick: number, tick: number): string {
    const seconds = (tick - startTick) / TICKS_PER_SECOND;
    return `+${fmtSeconds(seconds)}`;
}

export function fmtSeconds(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return "—";
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m${Math.round(seconds - minutes * 60)}s`;
}

export function fmtDuration(ms: number): string {
    if (!Number.isFinite(ms) || ms < 0) return "—";
    if (ms < 1000) return `${ms} ms`;
    return fmtSeconds(ms / 1000);
}

export function fmtDate(ms: number): string {
    if (!Number.isFinite(ms) || ms <= 0) return "—";
    return new Date(ms).toLocaleString("zh-CN", { hour12: false });
}

export function fmtBytes(size: number): string {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KiB`;
    return `${(size / 1024 / 1024).toFixed(2)} MiB`;
}

export function formatValue(value: unknown): string {
    if (value === null) return "null";
    if (value === undefined) return "";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (Array.isArray(value)) return value.map(formatValue).join(", ");
    return JSON.stringify(value);
}
