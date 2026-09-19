import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DecodeResponse, TraceExportMeta } from "./types";
import { buildViewModel } from "./model";
import { StoryView } from "./StoryView";
import { OverviewView } from "./OverviewView";
import { RawView } from "./RawView";
import { fmtBytes, fmtDate, fmtDuration } from "./format";

type Tab = "overview" | "activity" | "events";
type Health = "connecting" | "ok" | "bad";

const TEXT_PREVIEW_LIMIT = 2 * 1024 * 1024;

export function App() {
    const [health, setHealth] = useState<Health>("connecting");
    const [healthVersion, setHealthVersion] = useState("");
    const [input, setInput] = useState("");
    const [bytes, setBytes] = useState<Uint8Array | null>(null);
    const [sourceName, setSourceName] = useState("");
    const [result, setResult] = useState<DecodeResponse | null>(null);
    const [status, setStatus] = useState<{ text: string; kind?: "error" | "busy" }>({ text: "" });
    const [busy, setBusy] = useState(false);
    const [tab, setTab] = useState<Tab>("overview");
    const [importOpen, setImportOpen] = useState(true);
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetch("/api/health")
            .then((response) => response.json())
            .then((data) => {
                setHealth("ok");
                setHealthVersion(String(data.version ?? ""));
            })
            .catch(() => setHealth("bad"));
    }, []);

    const decode = useCallback(async (sessionId?: string) => {
        const payload = bytes ?? new TextEncoder().encode(input);
        if (payload.length === 0) {
            setStatus({ text: "请粘贴 Content Log 或选择 trace 文件", kind: "error" });
            setImportOpen(true);
            return;
        }
        setBusy(true);
        setStatus({ text: sessionId ? "正在切换会话…" : "正在解析 trace…", kind: "busy" });
        try {
            const url = sessionId
                ? `/api/decode?session=${encodeURIComponent(sessionId)}`
                : "/api/decode";
            const response = await fetch(url, {
                method: "POST",
                headers: { "content-type": "application/octet-stream" },
                body: payload as BodyInit,
            });
            const data: DecodeResponse = await response.json();
            setResult(data);
            if (data.ok && data.selected) {
                setStatus({ text: `已载入 ${data.selected.events.length} 条事件` });
                setTab("overview");
                setImportOpen(false);
            } else {
                setStatus({ text: data.error ?? "解析失败", kind: "error" });
            }
        } catch (error) {
            setStatus({ text: `请求失败：${(error as Error).message}`, kind: "error" });
        } finally {
            setBusy(false);
        }
    }, [bytes, input]);

    const loadFile = useCallback(async (file: File | null | undefined) => {
        if (!file) return;
        const loaded = new Uint8Array(await file.arrayBuffer());
        setBytes(loaded);
        setSourceName(file.name);
        if (file.size <= TEXT_PREVIEW_LIMIT && !file.name.endsWith(".begtrace")) {
            setInput(new TextDecoder("utf-8", { fatal: false }).decode(loaded));
        } else {
            setInput("");
        }
        setStatus({ text: `${file.name} · ${fmtBytes(file.size)}` });
    }, []);

    const clear = useCallback(() => {
        setInput("");
        setBytes(null);
        setSourceName("");
        setResult(null);
        setStatus({ text: "" });
        setImportOpen(true);
        if (fileRef.current) fileRef.current.value = "";
    }, []);

    const selected = result?.ok ? result.selected ?? null : null;
    const view = useMemo(() => (selected ? buildViewModel(selected) : null), [selected]);

    const download = useCallback(() => {
        if (!selected) return;
        const { header, end, stats, context, events } = selected;
        const blob = new Blob(
            [JSON.stringify({ header, end, stats, context, events }, null, 2)],
            { type: "application/json" }
        );
        const anchor = document.createElement("a");
        anchor.href = URL.createObjectURL(blob);
        anchor.download = `${header.sessionId}.json`;
        anchor.click();
        URL.revokeObjectURL(anchor.href);
    }, [selected]);

    return (
        <div className="app-shell">
            <Sidebar
                health={health}
                healthVersion={healthVersion}
                result={result}
                sourceName={sourceName}
                busy={busy}
                onImport={() => setImportOpen(true)}
                onSelect={(sessionId) => void decode(sessionId)}
            />
            <main className="workspace">
                <header className="workspace-bar">
                    <div className="breadcrumb">
                        <span>Observatory</span><span className="breadcrumb-separator">/</span>
                        <strong>{selected?.header.gameType ?? "工作台"}</strong>
                    </div>
                    <div className="workspace-actions">
                        {status.text ? <span className={`status${status.kind ? ` ${status.kind}` : ""}`}>{status.text}</span> : null}
                        {selected ? <button className="button quiet" onClick={download}>导出 JSON</button> : null}
                        <button className="button" onClick={() => setImportOpen(true)}>导入 trace</button>
                    </div>
                </header>
                <div className="workspace-content">
                    {importOpen ? (
                        <ImportPanel
                            input={input}
                            bytes={bytes}
                            busy={busy}
                            fileRef={fileRef}
                            onInput={(value) => {
                                setInput(value);
                                setBytes(null);
                                setSourceName(value ? "粘贴的 Content Log" : "");
                            }}
                            onFile={loadFile}
                            onDecode={() => void decode()}
                            onClear={clear}
                            onClose={selected ? () => setImportOpen(false) : undefined}
                        />
                    ) : null}
                    {!selected ? (
                        <EmptyWorkspace onImport={() => fileRef.current?.click()} />
                    ) : view ? (
                        <>
                            <SessionHeader selected={selected} />
                            <nav className="view-tabs" aria-label="分析视图">
                                <TabButton active={tab === "overview"} onClick={() => setTab("overview")}>分析概览</TabButton>
                                <TabButton active={tab === "activity"} onClick={() => setTab("activity")}>活动流</TabButton>
                                <TabButton active={tab === "events"} onClick={() => setTab("events")}>事件检索</TabButton>
                            </nav>
                            <div className="view-stage">
                                {tab === "overview" ? <OverviewView selected={selected} view={view} /> : null}
                                {tab === "activity" ? <StoryView selected={selected} view={view} /> : null}
                                {tab === "events" ? <RawView selected={selected} view={view} /> : null}
                            </div>
                        </>
                    ) : null}
                </div>
            </main>
        </div>
    );
}

function Sidebar({ health, healthVersion, result, sourceName, busy, onImport, onSelect }: {
    health: Health;
    healthVersion: string;
    result: DecodeResponse | null;
    sourceName: string;
    busy: boolean;
    onImport: () => void;
    onSelect: (sessionId: string) => void;
}) {
    const sessions = result?.exports ?? [];
    const current = result?.selected?.sessionId ?? result?.requestedSessionId ?? "";
    return (
        <aside className="sidebar">
            <div className="brand">
                <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>
                <div><div className="brand-name">BEGame</div><div className="brand-product">Observatory</div></div>
            </div>
            <button className="new-source" onClick={onImport}><span>＋</span> 导入数据源</button>
            <section className="side-section">
                <div className="side-heading"><span>会话</span><span>{sessions.length}</span></div>
                <div className="session-list">
                    {sessions.map((entry, index) => (
                        <SessionItem
                            key={entry.sessionId}
                            entry={entry}
                            index={index}
                            active={entry.sessionId === current}
                            disabled={busy || !entry.complete}
                            onClick={() => onSelect(entry.sessionId)}
                        />
                    ))}
                    {sessions.length === 0 ? <div className="side-empty">导入后，会话会出现在这里</div> : null}
                </div>
            </section>
            <div className="sidebar-spacer" />
            <section className="connection-card">
                <div className="connection-row">
                    <span className={`connection-dot ${health}`} />
                    <div>
                        <strong>{health === "ok" ? "本地服务" : health === "bad" ? "服务离线" : "正在连接"}</strong>
                        <span>{health === "ok" ? `API v${healthVersion}` : "127.0.0.1"}</span>
                    </div>
                    <span className="connection-mode">LOCAL</span>
                </div>
                <div className="source-label">当前数据源</div>
                <div className="source-name" title={sourceName || "未载入"}>{sourceName || "未载入"}</div>
                <div className="live-note"><span /> 实时连接接口预留</div>
            </section>
        </aside>
    );
}

function SessionItem({ entry, index, active, disabled, onClick }: {
    entry: TraceExportMeta;
    index: number;
    active: boolean;
    disabled: boolean;
    onClick: () => void;
}) {
    return (
        <button className={`session-item${active ? " active" : ""}`} disabled={disabled} onClick={onClick} title={entry.sessionId}>
            <span className="session-index">{String(index + 1).padStart(2, "0")}</span>
            <span className="session-copy">
                <strong>{entry.sessionId}</strong>
                <span>{entry.complete ? `${entry.partCount} 个分片 · 完整` : `缺少 ${entry.missingParts.join(", ")}`}</span>
            </span>
            <span className={`session-state${entry.complete ? " complete" : " incomplete"}`} />
        </button>
    );
}

function ImportPanel({ input, bytes, busy, fileRef, onInput, onFile, onDecode, onClear, onClose }: {
    input: string;
    bytes: Uint8Array | null;
    busy: boolean;
    fileRef: React.RefObject<HTMLInputElement | null>;
    onInput: (value: string) => void;
    onFile: (file: File | null | undefined) => void;
    onDecode: () => void;
    onClear: () => void;
    onClose?: () => void;
}) {
    return (
        <section className="import-panel">
            <div className="import-head">
                <div><span className="eyebrow">DATA SOURCE</span><h2>载入一次离线追踪</h2><p>支持 Content Log、文本日志和原始 .begtrace 容器。</p></div>
                {onClose ? <button className="icon-button" onClick={onClose} aria-label="关闭导入面板">×</button> : null}
            </div>
            <div className="drop-zone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void onFile(event.dataTransfer.files?.[0]); }}>
                <textarea
                    value={input}
                    spellCheck={false}
                    disabled={Boolean(bytes && !input)}
                    placeholder="粘贴包含 [BEGAME_TRACE:…] 的 Content Log"
                    onChange={(event) => onInput(event.target.value)}
                    onKeyDown={(event) => {
                        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                            event.preventDefault();
                            onDecode();
                        }
                    }}
                />
                <div className="drop-actions">
                    <label className="button quiet">
                        <input ref={fileRef} type="file" accept=".log,.txt,.begtrace" hidden onChange={(event) => { void onFile(event.target.files?.[0]); event.target.value = ""; }} />
                        选择文件
                    </label>
                    <span>或拖放到这里 · Ctrl+Enter 解析</span>
                    <div className="drop-spacer" />
                    {(input || bytes) ? <button className="button ghost" onClick={onClear}>清空</button> : null}
                    <button className="button primary" disabled={busy} onClick={onDecode}>{busy ? "解析中…" : "开始分析"}</button>
                </div>
            </div>
        </section>
    );
}

function EmptyWorkspace({ onImport }: { onImport: () => void }) {
    return (
        <section className="empty-workspace">
            <div className="empty-orbit" aria-hidden="true"><span /><span /><span /></div>
            <span className="eyebrow">TRACE ANALYSIS WORKSPACE</span>
            <h1>从一次对局，看见整个运行时。</h1>
            <p>载入 trace 后，在同一处检查状态生命周期、参与者、异常与每一条原始事件。</p>
            <button className="button primary large" onClick={onImport}>选择 trace 文件</button>
            <div className="capability-row"><span>多会话日志</span><i /><span>状态时间线</span><i /><span>事件检索</span><i /><span>实时管线预留</span></div>
        </section>
    );
}

function SessionHeader({ selected }: { selected: NonNullable<DecodeResponse["selected"]> }) {
    const diagnosticCount = selected.context.errors.length;
    return (
        <section className="session-header">
            <div>
                <div className="session-kicker"><span className={`run-status ${selected.end.status === "completed" ? "healthy" : "attention"}`} />{selected.end.status === "completed" ? "追踪已完成" : selected.end.status}</div>
                <h1>{selected.header.gameType}</h1>
                <div className="session-subtitle"><code>{selected.header.gameKey}</code><span>·</span><span>{fmtDate(selected.header.startWallTime)}</span></div>
            </div>
            <div className="session-facts">
                <div><span>持续时间</span><strong>{fmtDuration(selected.stats.wallSpanMs)}</strong></div>
                <div><span>事件</span><strong>{selected.stats.eventCount.toLocaleString("zh-CN")}</strong></div>
                <div><span>信号</span><strong className={diagnosticCount > 0 ? "attention-text" : "healthy-text"}>{diagnosticCount}</strong></div>
            </div>
        </section>
    );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return <button className={active ? "active" : ""} onClick={onClick}>{children}</button>;
}
