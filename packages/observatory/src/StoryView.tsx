import { useMemo, useState } from "react";
import type { SelectedSession, TraceEvent } from "./types";
import { buildRuns, nodeColor, type Run, type ViewModel } from "./model";
import { Chip, describeEvent } from "./describe";
import { fmtRel, fmtSeconds } from "./format";

interface StoryViewProps {
    selected: SelectedSession;
    view: ViewModel;
}

export function StoryView({ selected, view }: StoryViewProps) {
    const runs = useMemo(
        () => buildRuns(selected.events, view.owners),
        [selected, view]
    );
    const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

    const sectionId = (run: Run, index: number) => `${run.owner}:${index}`;
    const toggle = (id: string) => {
        setCollapsed((previous) => {
            const next = new Set(previous);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };
    const collapseAll = () =>
        setCollapsed(new Set(runs.map((run, index) => sectionId(run, index))));

    return (
        <div className="panel">
            <div className="panel-head">
                <h2>故事线</h2>
                <div className="toolbar">
                    <span className="meta">
                        {runs.length} 个阶段 · {selected.events.length} 条事件
                    </span>
                    <button className="btn" onClick={() => setCollapsed(new Set())}>
                        全部展开
                    </button>
                    <button className="btn" onClick={collapseAll}>
                        全部折叠
                    </button>
                </div>
            </div>
            <div className="story">
                {runs.map((run, index) => {
                    const id = sectionId(run, index);
                    return (
                        <StorySection
                            key={id}
                            run={run}
                            selected={selected}
                            view={view}
                            collapsed={collapsed.has(id)}
                            onToggle={() => toggle(id)}
                        />
                    );
                })}
            </div>
        </div>
    );
}

interface StorySectionProps {
    run: Run;
    selected: SelectedSession;
    view: ViewModel;
    collapsed: boolean;
    onToggle: () => void;
}

function StorySection({ run, selected, view, collapsed, onToggle }: StorySectionProps) {
    const node = view.nodes.get(run.owner);
    const first = selected.events[run.indexes[0]];
    const last = selected.events[run.indexes.at(-1)!];
    const entries = useMemo(
        () => buildEntries(run.indexes, selected.events),
        [run, selected.events]
    );
    const seconds = (last.tick - first.tick) / 20;

    return (
        <section className={`story-section${collapsed ? " collapsed" : ""}`}>
            <header className="story-head">
                <button className="caret" onClick={onToggle} aria-label="展开/折叠">
                    {collapsed ? "▸" : "▾"}
                </button>
                <span
                    className="story-color"
                    style={{ background: nodeColor(run.owner, view) }}
                />
                <h3>{sectionLabel(run, selected, view)}</h3>
                {node && node.key !== "session" && node.depth !== null ? (
                    <span className="depth">d{node.depth}</span>
                ) : null}
                <span className="meta">
                    {fmtRel(view.startTick, first.tick)} → {fmtRel(view.startTick, last.tick)} ·{" "}
                    {fmtSeconds(seconds)} · {run.indexes.length} 条
                </span>
            </header>
            <div className="story-body">
                {entries.map((entry) => (
                    <StoryItem
                        key={entry.event.sequence}
                        event={entry.event}
                        view={view}
                    />
                ))}
            </div>
        </section>
    );
}

function sectionLabel(run: Run, selected: SelectedSession, view: ViewModel): string {
    const node = view.nodes.get(run.owner);
    if (node && node.key !== "session") return node.name;
    const types = new Set(run.indexes.map((index) => selected.events[index].type));
    if (types.has("game.created") || types.has("game.starting")) return "会话 · 初始化";
    if (types.has("game.disposed") || types.has("game.stopped")) return "会话 · 收尾";
    return "会话";
}

interface Entry {
    event: TraceEvent;
}

function buildEntries(indexes: number[], events: TraceEvent[]): Entry[] {
    const entries: Entry[] = [];
    for (let position = 0; position < indexes.length; position++) {
        const event = events[indexes[position]];
        if (event.type === "state.push" || event.type === "state.enter") {
            continue;
        }
        if (event.type === "component.attach_started") {
            const next = events[indexes[position + 1]];
            if (
                next &&
                next.type === "component.attached" &&
                next.source.ref === event.source.ref
            ) {
                entries.push({ event: next });
                position++;
                continue;
            }
        }
        entries.push({ event });
    }
    return entries;
}

function StoryItem({ event, view }: { event: TraceEvent; view: ViewModel }) {
    const description = describeEvent(event, view);
    return (
        <div className={`story-item${description.severity ? ` ${description.severity}` : ""}`}>
            <span className="time" title={`tick ${event.tick} · #${event.sequence}`}>
                {fmtRel(view.startTick, event.tick)}
            </span>
            <span className="story-dot" />
            <div className="story-item-body">
                <div className="story-title">
                    <span>{description.title}</span>
                    {description.rawType && description.rawType !== description.title ? (
                        <code className="raw-type">{description.rawType}</code>
                    ) : null}
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
}
