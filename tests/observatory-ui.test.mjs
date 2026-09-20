import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { decodeTracePayload } from "../packages/observatory/src/decode.mjs";
import { OverviewView } from "../packages/observatory/src/OverviewView.tsx";
import { StreamView } from "../packages/observatory/src/StreamView.tsx";
import { StructureView } from "../packages/observatory/src/StructureView.tsx";
import { ParticipantsView } from "../packages/observatory/src/ParticipantsView.tsx";
import { RawView } from "../packages/observatory/src/RawView.tsx";

function load() {
    const result = decodeTracePayload(
        readFileSync(new URL("../traces/a.txt", import.meta.url))
    );
    return { selected: result.selected, analysis: result.analysis };
}

test("every view renders the real trace without a game-specific branch", () => {
    const { selected, analysis } = load();
    const noop = () => {};

    const overview = renderToString(
        createElement(OverviewView, { selected, analysis, onInspectFamily: noop })
    );
    expect(overview).toContain("事件族分布");
    expect(overview).toContain("诊断信号");
    expect(overview).toContain("业务事件");

    const stream = renderToString(
        createElement(StreamView, {
            selected,
            analysis,
            families: new Set(),
            onFamilies: noop,
            showInternal: false,
            onShowInternal: noop,
            search: "",
            onSearch: noop,
        })
    );
    // Internal machinery is hidden by default; the domain events show through.
    expect(stream).toContain("事件流");
    expect(stream).toContain("cards.played");

    const structure = renderToString(
        createElement(StructureView, { selected, analysis })
    );
    expect(structure).toContain("状态树");
    expect(structure).toContain("组件生命周期");
    // The synthetic session root must not be filed under itself.
    expect((structure.match(/class="tree-row"/g) || []).length).toBe(
        analysis.stateTree.length
    );

    const participants = renderToString(
        createElement(ParticipantsView, { selected, analysis })
    );
    expect(participants).toContain("参与者");
    expect(participants).toContain("座位");

    const raw = renderToString(createElement(RawView, { selected, analysis }));
    expect(raw).toContain("原始数据");
    expect(raw).toContain("分析 JSON");
});

test("a self-parented root still renders a bounded number of rows", () => {
    const node = (key, parentKey, depth) => ({
        key,
        ref: 0,
        name: key,
        depth,
        parentKey,
        children: [],
        enterTick: 0,
        exitTick: 10,
        enterSequence: 1,
        exitSequence: 2,
        pushSequence: 1,
        removeSequence: null,
        eventCount: 1,
        errorCount: 0,
    });
    const analysis = {
        startTick: 0,
        endTick: 10,
        tickSpan: 10,
        stateTree: [
            // What the old builder produced: the root pointed at itself.
            node("session", "session", -1),
            node("state:1", "session", 0),
        ],
        components: [],
    };
    const html = renderToString(
        createElement(StructureView, { selected: {}, analysis })
    );
    expect((html.match(/class="tree-row"/g) || []).length).toBe(2);
});
