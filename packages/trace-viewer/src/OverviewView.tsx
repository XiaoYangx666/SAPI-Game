import type { SeatChange, SelectedSession } from "./types";
import { nodeColor, seatColor, type ViewModel } from "./model";
import { Chip, describeEvent } from "./describe";
import { fmtDate, fmtDuration, fmtRel, fmtSeconds } from "./format";

interface ViewProps {
    selected: SelectedSession;
    view: ViewModel;
}

export function OverviewView({ selected, view }: ViewProps) {
    return (
        <>
            <Summary selected={selected} view={view} />
            <Participants selected={selected} />
            <Issues selected={selected} view={view} />
            <Timeline selected={selected} view={view} />
            <Histogram selected={selected} />
        </>
    );
}

function Summary({ selected, view }: ViewProps) {
    const { header, end, stats, context } = selected;
    const issues = context.errors.length;
    const cards: Array<{ label: string; value: string; tone?: "bad" | "ok" }> = [
        { label: "会话", value: header.sessionId },
        { label: "状态", value: `${end.status}${end.endReason ? ` · ${end.endReason}` : ""}` },
        { label: "游戏", value: `${header.gameType} · ${header.gameKey}` },
        { label: "开始时间", value: fmtDate(header.startWallTime) },
        { label: "时长", value: `${fmtDuration(stats.wallSpanMs)} · ${stats.tickSpan} ticks` },
        { label: "Tick", value: `${header.startTick} → ${end.endTick}` },
        { label: "事件 / 分块", value: `${stats.eventCount} / ${stats.chunkCount}` },
        {
            label: "参与者",
            value:
                context.seats.length > 0
                    ? `${context.seats.length} 个座位 · ${context.players.length} 位`
                    : `${context.players.length} 位`,
        },
        {
            label: "异常",
            value: issues > 0 ? `${issues} 条` : "无",
            tone: issues > 0 ? "bad" : "ok",
        },
    ];

    return (
        <div className="summary-grid">
            {cards.map((card) => (
                <div className="card" key={card.label}>
                    <div className="label">{card.label}</div>
                    <div
                        className="value"
                        style={
                            card.tone === "bad"
                                ? { color: "var(--danger)" }
                                : card.tone === "ok"
                                  ? { color: "var(--accent-2)" }
                                  : undefined
                        }
                    >
                        {card.value}
                    </div>
                </div>
            ))}
        </div>
    );
}

function Participants({ selected }: { selected: SelectedSession }) {
    const { seats, players } = selected.context;
    const startTick = selected.header.startTick;
    const seatless = players.filter((player) => player.seats.length === 0);
    const firstEvent = selected.events[0];
    const tickOf = (sequence: number) => {
        if (!firstEvent) return startTick;
        const index = sequence - firstEvent.sequence;
        return selected.events[index]?.tick ?? startTick;
    };

    return (
        <div className="panel">
            <div className="panel-head">
                <h2>参与者与座位</h2>
                <span className="meta">
                    {seats.length} 个座位 · {players.length} 位参与者
                </span>
            </div>
            <div className="participants">
                {seats.map((seat) => (
                    <div className="participant" key={`seat-${seat.seat}`}>
                        <div className="participant-head">
                            <span
                                className="dot"
                                style={{ background: seatColor(seat.seat) }}
                            />
                            <span className="name">
                                {seat.name ?? `座位 ${seat.seat}`}
                            </span>
                            <span className="kind">{kindLabel(seat.kind)}</span>
                        </div>
                        <div className="participant-history">
                            {seat.changes.map((change, index) => (
                                <div key={index}>
                                    {fmtRel(startTick, change.tick)} · {changeLabel(change)}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
                {seatless.map((player) => (
                    <div className="participant" key={`player-${player.id}`}>
                        <div className="participant-head">
                            <span className="dot" style={{ background: "#4aa8ff" }} />
                            <span className="name">{player.name ?? player.id}</span>
                            <span className="kind">参与者</span>
                        </div>
                        <div className="participant-history">
                            <div>
                                首次出现 {fmtRel(startTick, tickOf(player.firstSequence))}
                            </div>
                            <div>
                                最近活跃 {fmtRel(startTick, tickOf(player.lastSequence))}
                            </div>
                        </div>
                    </div>
                ))}
                {seats.length === 0 && players.length === 0 ? (
                    <div className="issue-empty">本局没有参与/座位事件</div>
                ) : null}
            </div>
        </div>
    );
}

function kindLabel(kind: string | undefined): string {
    if (kind === "human") return "玩家";
    if (kind === "bot") return "人机";
    if (kind === "empty") return "空位";
    return kind ?? "未知";
}

function changeLabel(change: SeatChange): string {
    if (change.kind === "empty") return "座位清空";
    const who = change.name ?? change.participantId ?? "?";
    const kind =
        change.kind === "bot"
            ? "（人机）"
            : change.kind === "human"
              ? "（玩家）"
              : change.kind
                ? `（${change.kind}）`
                : "";
    return `${who} 入座${kind}`;
}

function Issues({ selected, view }: ViewProps) {
    const issues = selected.context.errors;
    if (issues.length === 0) {
        return (
            <div className="panel">
                <div className="panel-head">
                    <h2>异常事件</h2>
                    <span className="meta">无</span>
                </div>
                <div className="issue-empty">没有发现失败/错误事件</div>
            </div>
        );
    }
    return (
        <div className="panel">
            <div className="panel-head">
                <h2>异常事件</h2>
                <span className="meta">{issues.length} 条</span>
            </div>
            <div className="issues">
                {issues.map((issue) => {
                    const event = selected.events[issue.eventIndex];
                    const description = describeEvent(event, view);
                    const node = view.nodes.get(issue.nodeKey);
                    return (
                        <div className="issue" key={issue.eventIndex}>
                            <span className="time">{fmtRel(view.startTick, event.tick)}</span>
                            <div>
                                <div>
                                    {description.title}
                                    <span className="scope">
                                        {node?.name ?? "会话"} · {event.type}
                                    </span>
                                </div>
                                {description.chips.length > 0 ? (
                                    <div className="story-chips">
                                        {description.chips.map((chip, index) => (
                                            <Chip key={index} data={chip} />
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function Timeline({ selected, view }: ViewProps) {
    const { header, stats } = selected;
    const span = Math.max(1, stats.tickSpan);
    return (
        <div className="panel">
            <div className="panel-head">
                <h2>状态时间线</h2>
                <span className="meta">
                    {stats.stateSpans.length} 个状态实例 · 共 {stats.tickSpan} ticks
                </span>
            </div>
            <div className="timeline">
                {stats.stateSpans.map((entry) => {
                    const left = ((entry.enterTick - header.startTick) / span) * 100;
                    const width = ((entry.exitTick - entry.enterTick) / span) * 100;
                    return (
                        <div className="timeline-row" key={entry.ref}>
                            <div
                                className="name"
                                title={`${entry.name} (ref #${entry.ref})`}
                            >
                                {entry.name}
                                {entry.depth !== null ? `  d${entry.depth}` : ""}
                            </div>
                            <div className="timeline-track">
                                <div
                                    className="timeline-bar"
                                    style={{
                                        left: `${Math.max(0, Math.min(100, left))}%`,
                                        width: `${Math.max(0.2, Math.min(100 - left, width))}%`,
                                        background: nodeColor(`state:${entry.ref}`, view),
                                    }}
                                    title={`${entry.name}\ntick ${entry.enterTick} → ${entry.exitTick} (${entry.exitTick - entry.enterTick} ticks)`}
                                />
                            </div>
                            <div className="time">
                                {fmtSeconds((entry.exitTick - entry.enterTick) / 20)}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function Histogram({ selected }: { selected: SelectedSession }) {
    const entries = Object.entries(selected.stats.typeCounts).sort(
        (a, b) => b[1] - a[1]
    );
    const max = entries.length > 0 ? entries[0][1] : 1;
    return (
        <div className="panel">
            <div className="panel-head">
                <h2>事件分布</h2>
                <span className="meta">{entries.length} 种事件类型</span>
            </div>
            <div className="histogram">
                {entries.map(([type, count]) => (
                    <div className="histogram-row" key={type}>
                        <div className="name" title={type}>
                            {type}
                        </div>
                        <div className="histogram-track">
                            <div
                                className="histogram-bar"
                                style={{ width: `${(count / max) * 100}%` }}
                            />
                        </div>
                        <div className="count">{count}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
