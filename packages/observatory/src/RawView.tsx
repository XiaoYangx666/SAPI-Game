import { useMemo, useState } from "react";
import type { SelectedSession, TraceEvent } from "./types";
import { nodeName, type ViewModel } from "./model";
import { fmtRel } from "./format";

const PAGE_SIZE = 300;

interface RawViewProps {
    selected: SelectedSession;
    view: ViewModel;
}

export function RawView({ selected, view }: RawViewProps) {
    const [filter, setFilter] = useState("");
    const [kind, setKind] = useState("all");
    const [limit, setLimit] = useState(PAGE_SIZE);

    const kinds = useMemo(
        () => Object.keys(selected.stats.sourceCounts).sort(),
        [selected]
    );

    const matched = useMemo(() => {
        const needle = filter.trim().toLowerCase();
        const result: Array<{ event: TraceEvent; index: number }> = [];
        selected.events.forEach((event, index) => {
            if (kind !== "all" && event.source.kind !== kind) return;
            if (needle) {
                const haystack = [
                    event.type,
                    event.source.kind,
                    event.source.name ?? "",
                    JSON.stringify(event.payload),
                ]
                    .join(" ")
                    .toLowerCase();
                if (!haystack.includes(needle)) return;
            }
            result.push({ event, index });
        });
        return result;
    }, [selected, filter, kind]);

    const shown = matched.slice(0, limit);
    const remaining = matched.length - shown.length;

    return (
        <div className="panel">
            <div className="panel-head">
                <h2>原始事件</h2>
                <div className="toolbar">
                    <input
                        className="filter"
                        placeholder="过滤 type / source / payload"
                        value={filter}
                        onChange={(event) => {
                            setFilter(event.target.value);
                            setLimit(PAGE_SIZE);
                        }}
                    />
                    <select
                        id="kind-filter"
                        value={kind}
                        onChange={(event) => {
                            setKind(event.target.value);
                            setLimit(PAGE_SIZE);
                        }}
                    >
                        <option value="all">全部来源</option>
                        {kinds.map((entry) => (
                            <option key={entry} value={entry}>
                                {entry} ({selected.stats.sourceCounts[entry]})
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            <div className="meta">
                显示 {shown.length} / 匹配 {matched.length} / 共 {selected.events.length} 条
            </div>
            <div className="events">
                {shown.map(({ event, index }) => (
                    <RawEvent
                        key={event.sequence}
                        event={event}
                        scope={nodeName(view.owners[index] ?? "session", view)}
                        startTick={view.startTick}
                    />
                ))}
            </div>
            {remaining > 0 ? (
                <button className="btn more" onClick={() => setLimit(limit + PAGE_SIZE)}>
                    加载更多（剩余 {remaining}）
                </button>
            ) : null}
        </div>
    );
}

function RawEvent({
    event,
    scope,
    startTick,
}: {
    event: TraceEvent;
    scope: string;
    startTick: number;
}) {
    const payload = JSON.stringify(event.payload);
    const preview = payload.length > 160 ? `${payload.slice(0, 160)}…` : payload;
    return (
        <details className="event">
            <summary>
                <span className="seq">#{event.sequence}</span>
                <span className="tick" title={`tick ${event.tick}`}>
                    {fmtRel(startTick, event.tick)}
                </span>
                <span className="scope" title={scope}>
                    {scope}
                </span>
                <span className="type" title={event.type}>
                    {event.type}
                </span>
                <span className="payload-preview">{preview}</span>
            </summary>
            <pre>{JSON.stringify(event.payload, null, 2)}</pre>
        </details>
    );
}
