import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DecodeResponse, TraceExportMeta } from "./types";
import { buildViewModel } from "./model";
import { StoryView } from "./StoryView";
import { OverviewView } from "./OverviewView";
import { RawView } from "./RawView";
import { fmtBytes, fmtDate, fmtDuration } from "./format";

type Tab = "overview" | "activity" | "events";
type Health = "connecting" | "ok" | "bad";
type LiveSource = "connect" | "net";
interface LiveSummary {
    sessionId: string;
    gameType: string;
    gameKey: string;
    status: string;
    startWallTime: number;
    eventCount: number;
    chunkCount: number;
    storedBytes: number;
    /** Present for BDS sessions: the pack that owns it. */
    source?: string;
}
interface NetStoreStatus {
    enabled: boolean;
    acceptingSessions: boolean;
    count: number;
    running: number;
}
interface NetSourceInfo {
    source: string;
    packName?: string;
    store: NetStoreStatus;
}

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
    const [connectConnected, setConnectConnected] = useState(false);
    const [connectUrl, setConnectUrl] = useState("ws://127.0.0.1:18789");
    const [netConnected, setNetConnected] = useState(false);
    const [netSources, setNetSources] = useState<NetSourceInfo[]>([]);
    const [netSource, setNetSource] = useState("");
    const [activeSource, setActiveSource] = useState<LiveSource>("connect");
    const [liveSessions, setLiveSessions] = useState<LiveSummary[]>([]);
    const [liveMode, setLiveMode] = useState(false);
    const [liveBusy, setLiveBusy] = useState(false);
    const selectedLiveId = useRef<string | null>(null);
    const selectedSourceRef = useRef<string | null>(null);
    const refreshingLive = useRef(false);

    useEffect(() => {
        fetch("/api/health")
            .then((response) => response.json())
            .then((data) => {
                setHealth("ok");
                setHealthVersion(String(data.version ?? ""));
            })
            .catch(() => setHealth("bad"));
    }, []);

    useEffect(() => {
        let active = true;
        let pending = false;
        const refresh = async () => {
            if (pending) return;
            pending = true;
            try {
                const [connectStatus, netStatus] = await Promise.all([
                    fetch("/api/connect/status").then((response) => response.json()).catch(() => ({ connected: false })),
                    fetch("/api/net/status").then((response) => response.json()).catch(() => ({ connected: false })),
                ]);
                if (!active) return;
                setConnectConnected(Boolean(connectStatus.connected));
                setConnectUrl(String(connectStatus.url ?? "ws://127.0.0.1:18789"));
                setNetConnected(Boolean(netStatus.connected));
                setNetSources(Array.isArray(netStatus.sources) ? netStatus.sources : []);
                if (liveMode) {
                    if (activeSource === "net") {
                        const response = await fetch("/api/net/sessions");
                        const data = await response.json();
                        if (active && response.ok) {
                            const flat: LiveSummary[] = [];
                            for (const source of data.sources ?? []) {
                                for (const session of source.sessions ?? []) {
                                    flat.push({ ...session, source: source.source });
                                }
                            }
                            setLiveSessions(flat);
                        }
                    } else {
                        const response = await fetch("/api/connect/sessions");
                        const data = await response.json();
                        if (active && response.ok) setLiveSessions(data.sessions ?? []);
                    }
                }
            } catch {
                if (active) { setConnectConnected(false); setNetConnected(false); }
            } finally { pending = false; }
        };
        void refresh();
        const timer = window.setInterval(() => void refresh(), 3000);
        return () => { active = false; window.clearInterval(timer); };
    }, [liveMode, activeSource]);

    // Follow the only connected source automatically; keep an explicit choice
    // when both are live.
    useEffect(() => {
        if (netConnected && !connectConnected) setActiveSource("net");
        else if (connectConnected && !netConnected) setActiveSource("connect");
    }, [connectConnected, netConnected]);

    // Keep a valid pack selected when BDS sources come and go.
    useEffect(() => {
        if (netSources.length === 0) {
            if (netSource !== "") setNetSource("");
            return;
        }
        if (!netSources.some((entry) => entry.source === netSource)) {
            setNetSource(netSources[0].source);
        }
    }, [netSources, netSource]);

    const loadLive = useCallback(async (id: string, background = false) => {
        if (background && refreshingLive.current) return;
        if (background) refreshingLive.current = true;
        if (!background) {
            selectedLiveId.current = id;
            setLiveBusy(true);
            setStatus({ text: `正在读取 ${id}…`, kind: "busy" });
        }
        try {
            const source = selectedSourceRef.current;
            const endpoint = activeSource === "net"
                ? `/api/net/session/${encodeURIComponent(id)}${source ? `?source=${encodeURIComponent(source)}` : ""}`
                : `/api/connect/session/${encodeURIComponent(id)}`;
            const response = await fetch(endpoint);
            if (!response.ok) throw new Error((await response.json()).error ?? "读取失败");
            const payload = new Uint8Array(await response.arrayBuffer());
            const decoded = await fetch("/api/decode", { method: "POST", headers: { "content-type": "application/octet-stream" }, body: payload as BodyInit });
            const data: DecodeResponse = await decoded.json();
            if (!data.ok || !data.selected) throw new Error(data.error ?? "解析失败");
            if (selectedLiveId.current !== id) return;
            if (data.selected.end.endReason === "live-snapshot") data.selected.end.status = "running";
            setResult(data);
            setSourceName(`${activeSource === "net" ? "BDS" : "Minecraft"} · ${id}`);
            setLiveMode(true);
            setImportOpen(false);
            if (!background) {
                setStatus({ text: `已载入 ${data.selected.events.length} 条事件` });
                setTab("overview");
            }
        } catch (error) { if (selectedLiveId.current === id) setStatus({ text: (error as Error).message, kind: "error" }); }
        finally {
            if (background) refreshingLive.current = false;
            else setLiveBusy(false);
        }
    }, [activeSource]);

    useEffect(() => {
        const id = result?.selected?.sessionId;
        if (!liveMode || !id || result?.selected?.end.status !== "running") return;
        const timer = window.setInterval(() => void loadLive(id, true), 3000);
        return () => window.clearInterval(timer);
    }, [liveMode, result?.selected, loadLive]);

    const exportLive = useCallback(async () => {
        const isNet = activeSource === "net";
        const count = isNet
            ? liveSessions.filter((entry) => entry.source).length
            : liveSessions.length;
        if (count === 0) return;
        setLiveBusy(true);
        setStatus({ text: `正在导出 ${count} 局…`, kind: "busy" });
        try {
            const endpoint = isNet ? "/api/net/export" : "/api/connect/export";
            const body = isNet
                ? { items: liveSessions.filter((entry) => entry.source).map((entry) => ({ source: entry.source, id: entry.sessionId })) }
                : { ids: liveSessions.map((entry) => entry.sessionId) };
            const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
            if (!response.ok) throw new Error((await response.json()).error ?? "导出失败");
            const blob = await response.blob();
            const anchor = document.createElement("a");
            anchor.href = URL.createObjectURL(blob);
            anchor.download = isNet ? "begame-bds-traces.zip" : "begame-traces.zip";
            anchor.click();
            window.setTimeout(() => URL.revokeObjectURL(anchor.href), 60000);
            setStatus({ text: `已导出 ${count} 局` });
        } catch (error) { setStatus({ text: (error as Error).message, kind: "error" }); }
        finally { setLiveBusy(false); }
    }, [liveSessions, activeSource]);

    const refreshLiveSessions = useCallback(async () => {
        if (activeSource !== "net") return;
        try {
            const response = await fetch("/api/net/sessions");
            const data = await response.json();
            if (response.ok) setLiveSessions(data.sessions ?? []);
        } catch { /* the polling effect retries */ }
    }, [activeSource]);

    const deleteLiveSession = useCallback(async (id: string, source: string) => {
        setLiveBusy(true);
        setStatus({ text: `正在删除 ${id}…`, kind: "busy" });
        try {
            const response = await fetch(`/api/net/session/${encodeURIComponent(id)}?source=${encodeURIComponent(source)}`, { method: "DELETE" });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error ?? "删除失败");
            if (selectedLiveId.current === id) {
                selectedLiveId.current = null;
                selectedSourceRef.current = null;
                setResult(null);
            }
            await refreshLiveSessions();
            setStatus({ text: data.deleted ? `已删除 ${id}` : `未找到 ${id}` });
        } catch (error) { setStatus({ text: (error as Error).message, kind: "error" }); }
        finally { setLiveBusy(false); }
    }, [refreshLiveSessions]);

    const clearLiveSessions = useCallback(async (source: string) => {
        setLiveBusy(true);
        setStatus({ text: "正在清空已完成会话…", kind: "busy" });
        try {
            const response = await fetch("/api/net/clear", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source }) });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error ?? "清空失败");
            await refreshLiveSessions();
            setStatus({ text: `已删除 ${data.removed} 局` });
        } catch (error) { setStatus({ text: (error as Error).message, kind: "error" }); }
        finally { setLiveBusy(false); }
    }, [refreshLiveSessions]);

    const toggleNetStore = useCallback(async (source: string, enabled: boolean) => {
        try {
            const response = await fetch("/api/net/store", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source, enabled }) });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error ?? "切换失败");
            setNetSources((current) => current.map((entry) => entry.source === source ? { ...entry, store: data.store } : entry));
            setStatus({ text: `Trace Store 已${data.store.enabled ? "开启" : "关闭"}` });
        } catch (error) { setStatus({ text: (error as Error).message, kind: "error" }); }
    }, []);

    const showLiveSessions = () => {
        if (liveMode) return;
        selectedLiveId.current = null;
        selectedSourceRef.current = null;
        setLiveMode(true);
        setResult(null);
        setSourceName(activeSource === "net" ? "BDS" : "Minecraft");
        setImportOpen(false);
        setStatus({ text: "请选择左侧游戏会话" });
    };

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
                selectedLiveId.current = null;
                setLiveMode(false);
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
                onImport={() => { selectedLiveId.current = null; setLiveMode(false); setImportOpen(true); }}
                onSelect={(sessionId) => void decode(sessionId)}
                connectConnected={connectConnected}
                connectUrl={connectUrl}
                netConnected={netConnected}
                netSources={netSources}
                netSource={netSource}
                netStore={netSources.find((entry) => entry.source === netSource)?.store ?? null}
                activeSource={activeSource}
                onSourceChange={(source) => { setActiveSource(source); setLiveSessions([]); selectedLiveId.current = null; selectedSourceRef.current = null; }}
                onNetSourceChange={setNetSource}
                liveSessions={liveSessions}
                liveMode={liveMode}
                liveBusy={liveBusy}
                onLiveMode={showLiveSessions}
                onLiveSelect={(id) => {
                    selectedSourceRef.current = liveSessions.find((entry) => entry.sessionId === id)?.source ?? null;
                    void loadLive(id);
                }}
                onExportLive={() => void exportLive()}
                onDeleteLive={(id) => {
                    const source = liveSessions.find((entry) => entry.sessionId === id)?.source ?? netSource;
                    void deleteLiveSession(id, source);
                }}
                onClearLive={() => void clearLiveSessions(netSource)}
                onToggleStore={(enabled) => void toggleNetStore(netSource, enabled)}
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
                        <button className="button" onClick={() => { selectedLiveId.current = null; setLiveMode(false); setImportOpen(true); }}>导入 trace</button>
                        {(connectConnected || netConnected) ? <button className="button quiet" onClick={showLiveSessions}>连接会话</button> : null}
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
                        liveMode ? <section className="empty-workspace"><span className="eyebrow">MINECRAFT CONNECTED</span><h1>选择一局游戏会话</h1><p>左侧列表会自动刷新。打开进行中的一局，可持续查看新事件。</p></section> : <EmptyWorkspace onImport={() => fileRef.current?.click()} />
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

function Sidebar({ health, healthVersion, result, sourceName, busy, onImport, onSelect, connectConnected, connectUrl, netConnected, netSources, netSource, netStore, activeSource, onSourceChange, onNetSourceChange, liveSessions, liveMode, liveBusy, onLiveMode, onLiveSelect, onExportLive, onDeleteLive, onClearLive, onToggleStore }: {
    health: Health;
    healthVersion: string;
    result: DecodeResponse | null;
    sourceName: string;
    busy: boolean;
    onImport: () => void;
    onSelect: (sessionId: string) => void;
    connectConnected: boolean;
    connectUrl: string;
    netConnected: boolean;
    netSources: NetSourceInfo[];
    netSource: string;
    netStore: NetStoreStatus | null;
    activeSource: LiveSource;
    onSourceChange: (source: LiveSource) => void;
    onNetSourceChange: (source: string) => void;
    liveSessions: LiveSummary[];
    liveMode: boolean;
    liveBusy: boolean;
    onLiveMode: () => void;
    onLiveSelect: (id: string) => void;
    onExportLive: () => void;
    onDeleteLive: (id: string) => void;
    onClearLive: () => void;
    onToggleStore: (enabled: boolean) => void;
}) {
    const sessions = liveMode ? [] : result?.exports ?? [];
    const current = result?.selected?.sessionId ?? result?.requestedSessionId ?? "";
    const anyConnected = connectConnected || netConnected;
    const currentSourceConnected = activeSource === "net" ? netConnected : connectConnected;
    return (
        <aside className="sidebar">
            <div className="brand">
                <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>
                <div><div className="brand-name">BEGame</div><div className="brand-product">Observatory</div></div>
            </div>
            <button className="new-source" onClick={onImport}><span>＋</span> 导入数据源</button>
            <section className="side-section">
                <div className="side-heading"><span>{liveMode ? "游戏会话" : "导入会话"}</span><span>{liveMode ? liveSessions.length : sessions.length}</span></div>
                <div className="session-list">
                    {liveMode ? liveSessions.map((entry, index) => <button className={`session-item${entry.sessionId === current ? " active" : ""}`} key={`${entry.source ?? ""}/${entry.sessionId}`} disabled={liveBusy} onClick={() => onLiveSelect(entry.sessionId)} title={entry.sessionId}>
                        <span className="session-index">{String(index + 1).padStart(2, "0")}</span><span className="session-copy"><strong>{entry.sessionId}</strong><span>{entry.source ? `${entry.source} · ` : ""}{entry.gameType} · {entry.eventCount} 条事件 · {entry.status === "running" ? "进行中" : "可查看"}</span></span><span className={`session-state${entry.status === "running" ? " incomplete" : " complete"}`} />
                    </button>) : null}
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
                    {(liveMode ? liveSessions.length : sessions.length) === 0 ? <div className="side-empty">{liveMode ? (currentSourceConnected ? "等待游戏会话" : "数据源未连接") : "导入后，会话会出现在这里"}</div> : null}
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
                <div className="source-label">游戏数据源</div>
                <div className="source-toggle">
                    <button className={activeSource === "net" ? "active" : ""} disabled={!netConnected} onClick={() => onSourceChange("net")}>BDS</button>
                    <button className={activeSource === "connect" ? "active" : ""} disabled={!connectConnected} onClick={() => onSourceChange("connect")}>/connect</button>
                </div>
                {activeSource === "net" && netConnected && netSources.length > 1 ? <div className="source-toggle">
                    {netSources.map((entry) => <button key={entry.source} className={entry.source === netSource ? "active" : ""} onClick={() => onNetSourceChange(entry.source)}>{entry.packName ?? entry.source}</button>)}
                </div> : null}
                <div className="live-note"><span /> {activeSource === "net"
                    ? (netConnected ? `BDS 已连接 · Store ${netStore?.enabled ? "ON" : "OFF"} · ${netStore?.count ?? 0} 局` : "等待 BDS 连接 ws://…:18790")
                    : (connectConnected ? "Minecraft 已连接 · 会话每 3 秒刷新" : `游戏输入 /connect ${connectUrl}`)}</div>
                <div className="source-label">当前数据源</div>
                <div className="source-name" title={sourceName || "未载入"}>{sourceName || "未载入"}</div>
                {anyConnected ? <div className="connect-actions"><button className="button quiet" onClick={onLiveMode}>查看游戏会话</button><button className="button quiet" disabled={liveBusy || liveSessions.length === 0} onClick={onExportLive}>批量导出 ZIP</button></div> : null}
                {activeSource === "net" && netConnected ? <div className="connect-actions">
                    <button className="button quiet" disabled={liveBusy} onClick={() => onToggleStore(!(netStore?.enabled ?? false))}>Store {netStore?.enabled ? "OFF" : "ON"}</button>
                    <button className="button quiet" disabled={liveBusy} onClick={onClearLive}>清空已完成</button>
                    {liveMode && current ? <button className="button quiet" disabled={liveBusy} onClick={() => onDeleteLive(current)}>删除当前</button> : null}
                </div> : null}
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
