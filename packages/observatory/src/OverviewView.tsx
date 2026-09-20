import type { EventFamily, SelectedSession, SessionAnalysis } from "./types";
import { eventTitle } from "./analysis.mjs";
import { FAMILY_LABELS, FAMILY_ORDER, FamilyBadge, Panel, PayloadChips, Stat, statusTone } from "./components";
import { fmtCount, fmtDate, fmtDuration, fmtRel, fmtTicks } from "./format";

interface Props {
    selected: SelectedSession;
    analysis: SessionAnalysis;
    onInspectFamily: (family: EventFamily) => void;
}

export function OverviewView({ selected, analysis, onInspectFamily }: Props) {
    const nodeNames = new Map(analysis.stateTree.map((node) => [node.key, node.name]));
    const families = FAMILY_ORDER.map((family) => ({ family, count: analysis.families[family] ?? 0 })).filter(
        (entry) => entry.count > 0
    );
    const maxFamily = Math.max(1, ...families.map((entry) => entry.count));
    const tone = statusTone(analysis.status);

    return (
        <>
            <div className="stat-grid">
                <Stat
                    label="运行结果"
                    value={analysis.status === "completed" ? "已完成" : analysis.status}
                    tone={tone}
                    hint={analysis.endReason}
                />
                <Stat label="持续时间" value={fmtDuration(analysis.durationMs)} />
                <Stat label="游戏内时间" value={`${fmtCount(analysis.tickSpan)} ticks`} hint={fmtTicks(analysis.tickSpan)} />
                <Stat label="事件" value={fmtCount(analysis.eventCount)} hint={`${analysis.chunkCount} 个分片`} />
                <Stat
                    label="内部事件"
                    value={fmtCount(analysis.internalCount)}
                    hint="状态/组件挂载、被取消的运行时任务等框架内部事件"
                />
                <Stat
                    label="参与者"
                    value={fmtCount(analysis.playerCount)}
                    hint={analysis.seatCount > 0 ? `${analysis.seatCount} 个座位` : undefined}
                />
                <Stat
                    label="业务事件"
                    value={fmtCount(analysis.domainCount)}
                    hint="自定义命名空间的事件"
                />
                <Stat
                    label="诊断"
                    value={analysis.errorCount === 0 ? "无" : fmtCount(analysis.errorCount)}
                    tone={analysis.errorCount > 0 ? "bad" : "ok"}
                />
            </div>

            <div className="overview-columns">
                <Panel
                    title="事件族分布"
                    meta={`${analysis.typeCounts ? Object.keys(analysis.typeCounts).length : 0} 种类型 · 点击筛选事件流`}
                >
                    <div className="family-bars">
                        {families.map(({ family, count }) => (
                            <button
                                key={family}
                                className="family-bar"
                                onClick={() => onInspectFamily(family)}
                                title={`查看 ${FAMILY_LABELS[family]} 事件`}
                            >
                                <FamilyBadge family={family} />
                                <span className="family-track">
                                    <span
                                        className={`family-fill family-${family}`}
                                        style={{ width: `${Math.max(2, (count / maxFamily) * 100)}%` }}
                                    />
                                </span>
                                <span className="family-count">{fmtCount(count)}</span>
                            </button>
                        ))}
                    </div>
                </Panel>

                <Panel title="会话信息">
                    <dl className="facts">
                        <div>
                            <dt>对局类型</dt>
                            <dd>{analysis.gameType}</dd>
                        </div>
                        <div>
                            <dt>对局键</dt>
                            <dd className="mono">{analysis.gameKey}</dd>
                        </div>
                        <div>
                            <dt>会话 ID</dt>
                            <dd className="mono">{analysis.sessionId}</dd>
                        </div>
                        <div>
                            <dt>开始</dt>
                            <dd>{fmtDate(analysis.startWallTime)}</dd>
                        </div>
                        <div>
                            <dt>结束原因</dt>
                            <dd>{analysis.endReason ?? "—"}</dd>
                        </div>
                        <div>
                            <dt>BEGame 版本</dt>
                            <dd>{selected.header.begameVersion ?? "—"}</dd>
                        </div>
                    </dl>
                </Panel>
            </div>

            <Panel
                title="诊断信号"
                meta={analysis.errorCount === 0 ? "无" : `${analysis.errorCount} 条`}
            >
                {analysis.errorCount === 0 ? (
                    <div className="empty">没有失败、拒绝或错误事件。</div>
                ) : (
                    <div className="diagnostic-list">
                        {analysis.diagnostics.map((diagnostic) => (
                            <article className="diagnostic" key={diagnostic.sequence}>
                                <span className="diagnostic-time" title={`tick ${diagnostic.tick}`}>
                                    {fmtRel(analysis.startTick, diagnostic.tick)}
                                </span>
                                <div className="diagnostic-body">
                                    <div className="diagnostic-head">
                                        <span className="diagnostic-title">
                                            {eventTitle(diagnostic)}
                                        </span>
                                        {eventTitle(diagnostic) !== diagnostic.type ? (
                                            <code>{diagnostic.type}</code>
                                        ) : null}
                                        <FamilyBadge family={diagnostic.family} />
                                        <span className="scope">
                                            {nodeNames.get(diagnostic.scope) ?? "会话"}
                                        </span>
                                    </div>
                                    {diagnostic.message ? (
                                        <p className="diagnostic-message">{diagnostic.message}</p>
                                    ) : null}
                                    <PayloadChips payload={diagnostic.payload} skip={["message"]} />
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </Panel>

            <div className="overview-columns">
                <Panel
                    title="参与者"
                    meta={
                        analysis.seatCount > 0
                            ? `${analysis.playerCount} 位 · ${analysis.seatCount} 个座位`
                            : `${analysis.playerCount} 位`
                    }
                >
                    {analysis.players.length === 0 ? (
                        <div className="empty">本局没有参与/座位事件。</div>
                    ) : (
                        <ul className="summary-list">
                            {analysis.players.map((player) => (
                                <li key={player.id}>
                                    <span className="summary-name">{player.name ?? player.id}</span>
                                    <span className="summary-meta">
                                        {player.seats.length > 0 ? `座位 ${player.seats.join(" / ")}` : ""}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>

                <Panel title="组件" meta={`${analysis.components.length} 个实例`}>
                    {analysis.components.length === 0 ? (
                        <div className="empty">本局没有组件事件。</div>
                    ) : (
                        <ul className="summary-list">
                            {analysis.components.map((component) => (
                                <li key={component.ref}>
                                    <span className="summary-name">{component.name}</span>
                                    <span className="summary-meta">
                                        {component.attachedTick !== null
                                            ? fmtRel(analysis.startTick, component.attachedTick)
                                            : "未挂载"}
                                        {component.detachedTick !== null
                                            ? ` → ${fmtRel(analysis.startTick, component.detachedTick)}`
                                            : ""}
                                        {component.errorCount > 0 ? ` · ${component.errorCount} 错误` : ""}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>
            </div>
        </>
    );
}
