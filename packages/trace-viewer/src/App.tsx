import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DecodeResponse } from "./types";
import { buildViewModel } from "./model";
import { StoryView } from "./StoryView";
import { OverviewView } from "./OverviewView";
import { RawView } from "./RawView";
import { fmtBytes } from "./format";

type Tab = "story" | "overview" | "raw";

const TEXT_PREVIEW_LIMIT = 2 * 1024 * 1024;

export function App() {
    const [health, setHealth] = useState<"connecting" | "ok" | "bad">("connecting");
    const [healthVersion, setHealthVersion] = useState("");
    const [input, setInput] = useState("");
    const [bytes, setBytes] = useState<Uint8Array | null>(null);
    const [result, setResult] = useState<DecodeResponse | null>(null);
    const [status, setStatus] = useState<{ text: string; kind?: "error" | "busy" }>({
        text: "",
    });
    const [busy, setBusy] = useState(false);
    const [tab, setTab] = useState<Tab>("story");
    const [inputCollapsed, setInputCollapsed] = useState(false);
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

    const decode = useCallback(
        async (sessionId?: string) => {
            const payload = bytes ?? new TextEncoder().encode(input);
            if (payload.length === 0) {
                setStatus({ text: "请先粘贴 Content Log 或选择文件", kind: "error" });
                return;
            }
            setBusy(true);
            setStatus({ text: "解码中…", kind: "busy" });
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
                    setStatus({ text: `解码成功：${data.selected.events.length} 条事件` });
                    setTab("story");
                    setInputCollapsed(true);
                } else {
                    setStatus({ text: data.error ?? "解码失败", kind: "error" });
                }
            } catch (error) {
                setStatus({
                    text: `请求失败：${(error as Error).message}`,
                    kind: "error",
                });
            } finally {
                setBusy(false);
            }
        },
        [bytes, input]
    );

    const loadFile = useCallback(async (file: File | null | undefined) => {
        if (!file) return;
        const loaded = new Uint8Array(await file.arrayBuffer());
        setBytes(loaded);
        if (file.size <= TEXT_PREVIEW_LIMIT && !file.name.endsWith(".begtrace")) {
            setInput(new TextDecoder("utf-8", { fatal: false }).decode(loaded));
        } else {
            setInput("");
        }
        setStatus({ text: `已载入 ${file.name}（${fmtBytes(file.size)}），点击"解码"` });
    }, []);

    const view = useMemo(
        () => (result?.ok && result.selected ? buildViewModel(result.selected) : null),
        [result]
    );

    const download = useCallback(() => {
        if (!result?.selected) return;
        const { header, end, stats, context, events } = result.selected;
        const blob = new Blob(
            [JSON.stringify({ header, end, stats, context, events }, null, 2)],
            { type: "application/json" }
        );
        const anchor = document.createElement("a");
        anchor.href = URL.createObjectURL(blob);
        anchor.download = `${header.sessionId}.json`;
        anchor.click();
        URL.revokeObjectURL(anchor.href);
    }, [result]);

    const clear = useCallback(() => {
        setInput("");
        setBytes(null);
        setResult(null);
        setStatus({ text: "" });
        if (fileRef.current) fileRef.current.value = "";
    }, []);

    const selected = result?.ok ? result.selected ?? null : null;

    return (
        <>
            <header className="topbar">
                <div>
                    <h1>BEGame Trace</h1>
                    <p className="subtitle">把对局日志变成可读的故事线</p>
                </div>
                <span
                    className={`badge${health === "ok" ? " ok" : health === "bad" ? " bad" : ""}`}
                >
                    {health === "ok"
                        ? `服务正常 · v${healthVersion}`
                        : health === "bad"
                          ? "无法连接服务"
                          : "连接中…"}
                </span>
            </header>

            <main>
                <section className={`panel${inputCollapsed ? " collapsed" : ""}`}>
                    <div className="panel-head">
                        <h2 className="clickable" onClick={() => setInputCollapsed((value) => !value)}>
                            输入日志
                        </h2>
                        <div className="toolbar">
                            <span className={`status${status.kind ? ` ${status.kind}` : ""}`}>
                                {status.text}
                            </span>
                            <label className="btn">
                                <input
                                    ref={fileRef}
                                    type="file"
                                    accept=".log,.txt,.begtrace"
                                    hidden
                                    onChange={(event) => {
                                        void loadFile(event.target.files?.[0]);
                                        event.target.value = "";
                                    }}
                                />
                                选择文件
                            </label>
                            <button
                                className="btn primary"
                                disabled={busy}
                                onClick={() => void decode()}
                            >
                                解码
                            </button>
                            <button className="btn" onClick={clear}>
                                清空
                            </button>
                        </div>
                    </div>
                    <textarea
                        value={input}
                        spellCheck={false}
                        placeholder="[Scripting][warning]-[BEGAME_TRACE:v1:session:1/1]QkVHVAE..."
                        onChange={(event) => {
                            setInput(event.target.value);
                            setBytes(null);
                        }}
                        onKeyDown={(event) => {
                            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                                event.preventDefault();
                                void decode();
                            }
                        }}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                            event.preventDefault();
                            void loadFile(event.dataTransfer?.files?.[0]);
                        }}
                    />
                    <div className="hint">
                        粘贴 Content Log，或拖入 .log / .txt / .begtrace 文件 · Ctrl+Enter 解码
                    </div>
                </section>

                {result ? (
                    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        {result.exports && result.exports.length > 0 ? (
                            <SessionBar result={result} onSelect={(sessionId) => void decode(sessionId)} />
                        ) : null}

                        <nav className="tabs">
                            <button
                                className={`tab${tab === "story" ? " active" : ""}`}
                                onClick={() => setTab("story")}
                            >
                                故事线
                            </button>
                            <button
                                className={`tab${tab === "overview" ? " active" : ""}`}
                                onClick={() => setTab("overview")}
                            >
                                概览
                            </button>
                            <button
                                className={`tab${tab === "raw" ? " active" : ""}`}
                                onClick={() => setTab("raw")}
                            >
                                原始事件
                            </button>
                            <span className="spacer" />
                            <button
                                className="btn"
                                disabled={!selected}
                                onClick={download}
                            >
                                下载 JSON
                            </button>
                        </nav>

                        {selected && view ? (
                            <>
                                {tab === "story" ? (
                                    <StoryView selected={selected} view={view} />
                                ) : null}
                                {tab === "overview" ? (
                                    <OverviewView selected={selected} view={view} />
                                ) : null}
                                {tab === "raw" ? (
                                    <RawView selected={selected} view={view} />
                                ) : null}
                            </>
                        ) : null}
                    </section>
                ) : null}
            </main>
        </>
    );
}

function SessionBar({
    result,
    onSelect,
}: {
    result: DecodeResponse;
    onSelect: (sessionId: string) => void;
}) {
    const exports = result.exports ?? [];
    const current = result.selected?.sessionId ?? result.requestedSessionId ?? "";
    return (
        <div className="panel session-bar">
            <span className="meta">日志内共 {exports.length} 个导出：</span>
            <select value={current} onChange={(event) => onSelect(event.target.value)}>
                {exports.map((entry) => (
                    <option key={entry.sessionId} value={entry.sessionId}>
                        {entry.complete
                            ? `${entry.sessionId} · 完整 ${entry.partCount}/${entry.partCount}`
                            : `${entry.sessionId} · 缺分片 ${entry.missingParts.join(", ")}`}
                    </option>
                ))}
            </select>
            {result.selected ? (
                <span className="meta">
                    {result.selected.header.gameType} · {result.selected.header.gameKey}
                </span>
            ) : null}
        </div>
    );
}
