import { useState, type ReactNode } from "react";
import type { EventFamily, EventSeverity } from "./types";

export const FAMILY_LABELS: Record<EventFamily, string> = {
    game: "对局",
    state: "状态",
    component: "组件",
    participation: "参与",
    connection: "连接",
    timeout: "超时",
    runtime: "运行时",
    debug: "调试",
    domain: "业务",
};

export const FAMILY_ORDER: EventFamily[] = [
    "game",
    "state",
    "component",
    "participation",
    "connection",
    "timeout",
    "runtime",
    "debug",
    "domain",
];

export function FamilyBadge({ family, count }: { family: EventFamily; count?: number }) {
    return (
        <span className={`family family-${family}`}>
            {FAMILY_LABELS[family]}
            {count !== undefined ? <b>{count}</b> : null}
        </span>
    );
}

export function SeverityDot({ severity }: { severity: EventSeverity }) {
    return <span className={`severity-dot ${severity}`} aria-hidden="true" />;
}

export function Chip({
    label,
    value,
    tone,
    title,
}: {
    label?: string;
    value: ReactNode;
    tone?: "error" | "accent";
    title?: string;
}) {
    return (
        <span className={`chip${tone ? ` ${tone}` : ""}`} title={title}>
            {label ? <span className="chip-label">{label}</span> : null}
            <span className="chip-value">{value}</span>
        </span>
    );
}

export function Stat({
    label,
    value,
    tone,
    hint,
}: {
    label: string;
    value: ReactNode;
    tone?: "ok" | "warn" | "bad";
    hint?: string;
}) {
    return (
        <div className="stat" title={hint}>
            <span className="stat-label">{label}</span>
            <strong className={`stat-value${tone ? ` ${tone}` : ""}`}>{value}</strong>
        </div>
    );
}

export function Panel({
    title,
    meta,
    actions,
    children,
    className,
}: {
    title?: ReactNode;
    meta?: ReactNode;
    actions?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    return (
        <section className={`panel${className ? ` ${className}` : ""}`}>
            {title || meta || actions ? (
                <header className="panel-head">
                    <div className="panel-title">
                        {title ? <h2>{title}</h2> : null}
                        {meta ? <span className="meta">{meta}</span> : null}
                    </div>
                    {actions ? <div className="toolbar">{actions}</div> : null}
                </header>
            ) : null}
            {children}
        </section>
    );
}

export function Empty({ children }: { children: ReactNode }) {
    return <div className="empty">{children}</div>;
}

export function CopyButton({ text, label = "复制" }: { text: string; label?: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <button
            type="button"
            className="btn"
            onClick={() => {
                void navigator.clipboard?.writeText(text).then(
                    () => {
                        setCopied(true);
                        window.setTimeout(() => setCopied(false), 1200);
                    },
                    () => setCopied(false)
                );
            }}
        >
            {copied ? "已复制" : label}
        </button>
    );
}

export function statusTone(status: string): "ok" | "warn" | "bad" {
    if (status === "completed") return "ok";
    if (status === "running") return "warn";
    return "bad";
}

/** Generic scalar-field chips for any event payload; no field names are special. */
export function PayloadChips({ payload, skip = [] }: { payload: unknown; skip?: string[] }) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
    const entries = Object.entries(payload as Record<string, unknown>).filter(
        ([key, value]) =>
            !skip.includes(key) &&
            value !== undefined &&
            (value === null ||
                typeof value === "string" ||
                typeof value === "number" ||
                typeof value === "boolean" ||
                Array.isArray(value))
    );
    if (entries.length === 0) return null;
    return (
        <div className="chips">
            {entries.map(([key, value]) => {
                const text = Array.isArray(value)
                    ? value.map((item) => String(item)).join(", ")
                    : String(value);
                return (
                    <Chip
                        key={key}
                        label={key}
                        value={text.length > 120 ? `${text.slice(0, 120)}…` : text}
                        title={text}
                    />
                );
            })}
        </div>
    );
}
