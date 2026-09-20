import { useMemo, useState } from "react";
import type { EventFamily, SelectedSession, SessionAnalysis } from "./types";
import {
    eventFamily,
    eventSubtype,
    eventTitle,
    isInternalEvent,
    summarizeEvent,
} from "./analysis.mjs";
import {
    FAMILY_LABELS,
    FAMILY_ORDER,
    FamilyBadge,
    CopyButton,
    PayloadChips,
} from "./components";
import { fmtRel } from "./format";

const PAGE_SIZE = 300;

type Mode = "events" | "analysis" | "session";

interface Props {
    selected: SelectedSession;
    analysis: SessionAnalysis;
}

export function RawView({ selected, analysis }: Props) {
    const [mode, setMode] = useState<Mode>("events");

    const sessionJson = useMemo(
        () =>
            JSON.stringify(
                {
                    header: selected.header,
                    end: selected.end,
                    stats: selected.stats,
                    context: selected.context,
                    events: selected.events,
                },
                null,
                2
            ),
        [selected]
    );
    const analysisJson = useMemo(() => JSON.stringify(analysis, null, 2), [analysis]);

    const download = (name: string, text: string) => {
        const blob = new Blob([text], { type: "application/json" });
        const anchor = document.createElement("a");
        anchor.href = URL.createObjectURL(blob);
        anchor.download = name;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(anchor.href), 60000);
    };

    return (
        <div className="panel">
            <header className="panel-head">
                <div className="panel-title">
                    <h2>原始数据</h2>
                    <span className="meta">供人直接查看，也供 agent 读取</span>
                </div>
                <div className="toolbar">
                    <div className="segmented">
                        <button className={mode === "events" ? "active" : ""} onClick={() => setMode("events")}>
                            事件
                        </button>
                        <button className={mode === "analysis" ? "active" : ""} onClick={() => setMode("analysis")}>
                            分析 JSON
                        </button>
                        <button className={mode === "session" ? "active" : ""} onClick={() => setMode("session")}>
                            会话 JSON
                        </button>
                    </div>
                </div>
            </header>

            {mode === "events" ? (
                <RawEvents selected={selected} analysis={analysis} />
            ) : (
                <>
                    <div className="json-actions">
                        <CopyButton text={mode === "analysis" ? analysisJson : sessionJson} label="复制 JSON" />
                        <button
                            className="btn"
                            onClick={() =>
                                download(
                                    `${analysis.sessionId}.${mode === "analysis" ? "analysis" : "session"}.json`,
                                    mode === "analysis" ? analysisJson : sessionJson
                                )
                            }
                        >
                            下载 JSON
                        </button>
                        <span className="meta">
                            {mode === "analysis"
                                ? "通用分析模型：事件族、参与者、状态树、组件、诊断"
                                : "解码后的完整会话：header / end / stats / context / events"}
                        </span>
                    </div>
                    <pre className="json-block">{mode === "analysis" ? analysisJson : sessionJson}</pre>
                </>
            )}
        </div>
    );
}

function RawEvents({ selected, analysis }: { selected: SelectedSession; analysis: SessionAnalysis }) {
    const [search, setSearch] = useState("");
    const [family, setFamily] = useState<EventFamily | "all">("all");
    const [source, setSource] = useState("all");
    const [showInternal, setShowInternal] = useState(true);
    const [limit, setLimit] = useState(PAGE_SIZE);

    const sources = useMemo(() => Object.keys(selected.stats.sourceCounts).sort(), [selected]);

    const matched = useMemo(() => {
        const needle = search.trim().toLowerCase();
        const list: Array<{ event: SelectedSession["events"][number]; index: number }> = [];
        selected.events.forEach((event, index) => {
            if (family !== "all" && eventFamily(event.type) !== family) return;
            if (source !== "all" && event.source.kind !== source) return;
            if (!showInternal && isInternalEvent(event.type)) return;
            if (needle) {
                const subtype = eventSubtype(event);
                const haystack = [
                    event.type,
                    subtype ?? "",
                    event.source.kind,
                    event.source.name ?? "",
                    JSON.stringify(event.payload),
                ]
                    .join(" ")
                    .toLowerCase();
                if (!haystack.includes(needle)) return;
            }
            list.push({ event, index });
        });
        return list;
    }, [selected, family, source, showInternal, search]);

    const shown = matched.slice(0, limit);

    return (
        <>
            <div className="toolbar raw-toolbar">
                <input
                    className="filter"
                    placeholder="搜索 type / source / payload"
                    value={search}
                    onChange={(event) => {
                        setSearch(event.target.value);
                        setLimit(PAGE_SIZE);
                    }}
                />
                <select
                    value={family}
                    onChange={(event) => {
                        setFamily(event.target.value as EventFamily | "all");
                        setLimit(PAGE_SIZE);
                    }}
                >
                    <option value="all">全部事件族</option>
                    {FAMILY_ORDER.map((name) => (
                        <option key={name} value={name}>
                            {FAMILY_LABELS[name]} ({analysis.families[name] ?? 0})
                        </option>
                    ))}
                </select>
                <select
                    value={source}
                    onChange={(event) => {
                        setSource(event.target.value);
                        setLimit(PAGE_SIZE);
                    }}
                >
                    <option value="all">全部来源</option>
                    {sources.map((name) => (
                        <option key={name} value={name}>
                            {name} ({selected.stats.sourceCounts[name]})
                        </option>
                    ))}
                </select>
                <label className="toggle">
                    <input
                        type="checkbox"
                        checked={showInternal}
                        onChange={(event) => {
                            setShowInternal(event.target.checked);
                            setLimit(PAGE_SIZE);
                        }}
                    />
                    显示内部事件
                </label>
            </div>
            <div className="meta">
                显示 {shown.length} / 匹配 {matched.length} / 共 {selected.events.length} 条
            </div>
            <div className="events">
                {shown.map(({ event, index }) => {
                    const title = eventTitle(event);
                    const summary = summarizeEvent(event);
                    return (
                        <details className="event" key={event.sequence}>
                            <summary>
                                <span className="seq">#{event.sequence}</span>
                                <span className="tick">{fmtRel(analysis.startTick, event.tick)}</span>
                                <FamilyBadge family={eventFamily(event.type) as EventFamily} />
                                <span className="scope" title={analysis.stateTree.find((n) => n.key === selected.context.eventOwners[index])?.name}>
                                    {analysis.stateTree.find((n) => n.key === selected.context.eventOwners[index])?.name ?? "会话"}
                                </span>
                                <span className="type">
                                    {title}
                                    {title !== event.type ? <code className="raw-type">{event.type}</code> : null}
                                </span>
                                <span className="payload-preview">{summary}</span>
                            </summary>
                            <div className="row-detail">
                                <PayloadChips payload={event.payload} />
                                <pre>{JSON.stringify(event.payload, null, 2)}</pre>
                            </div>
                        </details>
                    );
                })}
            </div>
            {matched.length > shown.length ? (
                <button className="btn more" onClick={() => setLimit(limit + PAGE_SIZE)}>
                    加载更多（剩余 {matched.length - shown.length}）
                </button>
            ) : null}
        </>
    );
}
