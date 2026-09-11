import type { CSSProperties } from "react";
import type { TraceEvent } from "./types";
import { seatColor, playerColor, playerText, type ViewModel } from "./model";
import { formatValue } from "./format";

export interface ChipData {
    label: string;
    value?: string;
    className?: string;
    color?: string;
    title?: string;
}

export function Chip({ data }: { data: ChipData }) {
    return (
        <span
            className={`chip${data.className ? ` ${data.className}` : ""}`}
            style={data.color ? ({ "--chip-color": data.color } as CSSProperties) : undefined}
            title={data.title}
        >
            <span className="chip-label">{data.label}</span>
            {data.value ? <span className="chip-value">{data.value}</span> : null}
        </span>
    );
}

export type Severity = "" | "muted" | "error" | "accent";

export interface EventDescription {
    title: string;
    rawType?: string;
    severity: Severity;
    chips: ChipData[];
}

const BUILTIN_TITLES: Record<string, string> = {
    "game.created": "对局创建",
    "game.starting": "对局启动中",
    "game.started": "对局已启动",
    "game.start_failed": "对局启动失败",
    "game.stopping": "对局正在停止",
    "game.stopped": "对局已停止",
    "game.disposed": "对局已销毁",
    "state.push": "状态入栈",
    "state.enter": "状态进入",
    "state.exit": "状态退出",
    "state.remove": "状态移除",
    "state.transition": "状态切换",
    "state.root_changed": "根状态变更",
    "state.enter_failed": "状态进入失败",
    "component.attach_started": "组件开始挂载",
    "component.attached": "组件挂载完成",
    "component.detached": "组件卸载",
    "component.attach_failed": "组件挂载失败",
    "component.error": "组件运行错误",
    "participation.acquire": "玩家申请加入",
    "participation.joined": "玩家加入对局",
    "participation.released": "玩家离开对局",
    "participation.acquire_rejected": "加入请求被拒绝",
    "player.connect": "玩家连接",
    "player.disconnect": "玩家断开",
    "player.reconnect": "玩家重连",
    "disconnect_timeout.started": "断线超时开始",
    "disconnect_timeout.cancelled": "断线超时取消",
    "disconnect_timeout.expired": "断线超时到期",
    "runner.uncaught_error": "异步任务未捕获错误",
    "runner.cancelled": "异步任务取消",
    "timer.started": "计时器启动",
    "timer.expired": "计时器到期",
    "timer.cancelled": "计时器取消",
    "debug.message": "调试消息",
};

const EVENT_VERBS: Record<string, string> = {
    created: "创建",
    starting: "启动中",
    started: "开始",
    start_failed: "启动失败",
    stopping: "停止中",
    stopped: "停止",
    disposed: "销毁",
    acquire: "申请加入",
    joined: "加入",
    released: "离开",
    acquire_rejected: "加入被拒",
    connect: "连接",
    disconnect: "断开",
    reconnect: "重连",
    expired: "到期",
    cancelled: "取消",
    failed: "失败",
    played: "出牌",
    passed: "过牌",
    call: "叫牌",
    rob: "抢牌",
    decided: "确定",
    finished: "结束",
    settled: "结算",
    changed: "变更",
    reset: "重置",
    round_started: "回合开始",
    round_settled: "回合结算",
    round_finished: "回合结束",
    attach_started: "开始挂载",
    attached: "挂载完成",
    detached: "卸载",
    attach_failed: "挂载失败",
    error: "错误",
    uncaught_error: "未捕获错误",
    message: "消息",
};

const FIELD_LABELS: Record<string, string> = {
    seat: "座位",
    player: "玩家",
    participantId: "参与者",
    name: "名字",
    roundNumber: "轮次",
    cards: "牌",
    value: "值",
    flag: "标志",
    multiplier: "倍数",
    kind: "类型",
    reason: "原因",
    detail: "详情",
    operation: "操作",
    from: "从",
    to: "到",
    depth: "深度",
    state: "状态",
    component: "组件",
    gameType: "游戏",
    gameKey: "对局键",
    success: "成功",
    message: "消息",
    stack: "堆栈",
    eventCount: "事件数",
    aliveCount: "存活",
    score: "得分",
};

const FIELD_ORDER = [
    "seat",
    "player",
    "participantId",
    "name",
    "roundNumber",
    "cards",
    "value",
    "flag",
    "multiplier",
    "kind",
    "reason",
    "detail",
    "operation",
    "state",
    "component",
    "success",
];

const ERROR_TYPES = new Set([
    "component.error",
    "runner.uncaught_error",
    "game.start_failed",
    "state.enter_failed",
]);

const MUTED_TYPES = new Set([
    "state.push",
    "state.enter",
    "state.exit",
    "state.remove",
    "component.attach_started",
    "component.detached",
]);

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function humanizeType(type: string): { title: string; matched: boolean } {
    const last = String(type).split(/[.:]/).at(-1) ?? type;
    const verb = EVENT_VERBS[last];
    return verb ? { title: verb, matched: true } : { title: type, matched: false };
}

function fieldChip(key: string, value: unknown, view: ViewModel): ChipData {
    if (key === "seat" && typeof value === "number") {
        const info = view.seats.get(value);
        return {
            label: `座位${value}`,
            value: info?.name ? `· ${info.name}` : undefined,
            className: "seat",
            color: seatColor(value),
        };
    }
    if ((key === "player" || key === "participantId") && typeof value === "string") {
        return {
            label: "玩家",
            value: playerText(value, view),
            className: "player",
            color: playerColor(value, view),
        };
    }
    const text = formatValue(value);
    return {
        label: FIELD_LABELS[key] ?? key,
        value: text.length > 120 ? `${text.slice(0, 120)}…` : text,
        title: text.length > 120 ? text : undefined,
    };
}

function payloadChips(
    payload: Record<string, unknown>,
    view: ViewModel,
    skip: string[] = []
): ChipData[] {
    return Object.entries(payload)
        .filter(([key, value]) => !skip.includes(key) && value !== undefined)
        .sort((a, b) => {
            const indexA = FIELD_ORDER.indexOf(a[0]);
            const indexB = FIELD_ORDER.indexOf(b[0]);
            return (indexA === -1 ? FIELD_ORDER.length : indexA) -
                (indexB === -1 ? FIELD_ORDER.length : indexB);
        })
        .map(([key, value]) => fieldChip(key, value, view));
}

export function describeEvent(event: TraceEvent, view: ViewModel): EventDescription {
    const payload = asRecord(event.payload);
    let severity: Severity = "";
    if (ERROR_TYPES.has(event.type) || event.type.endsWith("_failed") || event.type.endsWith("_rejected")) {
        severity = "error";
    } else if (MUTED_TYPES.has(event.type)) {
        severity = "muted";
    } else if (event.type === "state.transition" || event.type === "state.root_changed") {
        severity = "accent";
    }

    if (event.type === "debug.message") {
        const message = typeof event.payload === "string" ? event.payload : payload.message;
        return {
            title: typeof message === "string" ? message : "调试消息",
            rawType: event.type,
            severity,
            chips: typeof event.payload === "string" ? [] : payloadChips(payload, view, ["message"]),
        };
    }

    if (event.type === "state.transition" || event.type === "state.root_changed") {
        const from = typeof payload.from === "string" ? payload.from : undefined;
        const to = typeof payload.to === "string" ? payload.to : undefined;
        const chips: ChipData[] = [];
        if (from || to) chips.push({ label: "", value: `${from ?? "?"} → ${to ?? "?"}` });
        if (typeof payload.operation === "string") {
            chips.push({ label: "操作", value: payload.operation });
        }
        if (typeof payload.reason === "string") {
            chips.push({ label: "原因", value: payload.reason });
        }
        return {
            title: BUILTIN_TITLES[event.type] ?? event.type,
            rawType: event.type,
            severity,
            chips,
        };
    }

    const builtinTitle = BUILTIN_TITLES[event.type];
    if (builtinTitle) {
        return {
            title: builtinTitle,
            rawType: event.type,
            severity,
            chips: payloadChips(payload, view),
        };
    }

    const customType = typeof payload.type === "string" ? payload.type : event.type;
    const { title, matched } = humanizeType(customType);
    return {
        title,
        rawType: matched ? customType : undefined,
        severity,
        chips: payloadChips(payload, view, ["type"]),
    };
}
