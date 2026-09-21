import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { loadConfig, normalizeTargets } from "../packages/observatory/server/config.ts";
import { parseServerOptions } from "../packages/observatory/server/options.ts";

const emptyEnv = {};

function parse(argv, env = emptyEnv, config = {}) {
    const result = parseServerOptions(argv, env, config);
    if (!result.ok) throw new Error(result.error);
    return result.options;
}

function configFile(contents) {
    const dir = mkdtempSync(join(tmpdir(), "obs-config-"));
    const path = join(dir, "observatory.config.json");
    writeFileSync(path, contents);
    return path;
}

// ---------------------------------------------------------------------------
// targets normalization
// ---------------------------------------------------------------------------

test("targets accept a namespace map and a list", () => {
    const asMap = normalizeTargets({ ddz: { packName: "DDZ" } });
    expect(asMap.warnings).toEqual([]);
    expect(asMap.targets).toEqual([{ namespace: "ddz", packName: "DDZ", games: undefined }]);

    const asList = normalizeTargets([
        { namespace: "ddz", packName: "DDZ", games: ["doudizhu"] },
        { namespace: "game" },
    ]);
    expect(asList.warnings).toEqual([]);
    expect(asList.targets).toEqual([
        { namespace: "ddz", packName: "DDZ", games: ["doudizhu"] },
        { namespace: "game", packName: undefined, games: undefined },
    ]);
});

test("invalid and duplicate namespaces are dropped with a warning", () => {
    // Uppercase and dashes cannot be Bedrock command namespaces; a bad value
    // would otherwise produce commands the game refuses to parse.
    const { targets, warnings } = normalizeTargets([
        { namespace: "DDZ" },
        { namespace: "with-dash" },
        { namespace: "ddz" },
        { namespace: "ddz" },
        { namespace: "game" },
    ]);
    expect(targets.map((target) => target.namespace)).toEqual(["ddz", "game"]);
    expect(warnings.filter((warning) => warning.includes("无效"))).toHaveLength(2);
    expect(warnings.filter((warning) => warning.includes("重复"))).toHaveLength(1);
});

test("a malformed targets value is ignored rather than fatal", () => {
    expect(normalizeTargets(undefined).targets).toEqual([]);
    expect(normalizeTargets("ddz").warnings[0]).toMatch(/必须是对象或数组/);
});

// ---------------------------------------------------------------------------
// config file loading
// ---------------------------------------------------------------------------

test("a missing config file is not an error", () => {
    const loaded = loadConfig([join(tmpdir(), "definitely-absent-observatory.config.json")]);
    expect(loaded.config).toEqual({});
    expect(loaded.path).toBeUndefined();
    expect(loaded.warnings).toEqual([]);
});

test("a malformed config file warns instead of throwing", () => {
    const loaded = loadConfig([configFile("{ not json")]);
    expect(loaded.config).toEqual({});
    expect(loaded.warnings[0]).toMatch(/不是合法 JSON/);
});

test("the first readable config file wins", () => {
    const first = configFile(JSON.stringify({ port: 1111 }));
    const second = configFile(JSON.stringify({ port: 2222 }));
    const loaded = loadConfig([first, second]);
    expect(loaded.config.port).toBe(1111);
    expect(loaded.path).toBe(first);
});

test("bad field types are reported and dropped", () => {
    const loaded = loadConfig([
        configFile(JSON.stringify({ port: "nope", connect: { port: 99999 }, net: 5 })),
    ]);
    expect(loaded.config.port).toBeUndefined();
    expect(loaded.config.connect?.port).toBeUndefined();
    expect(loaded.config.net).toBeUndefined();
    expect(loaded.warnings.length).toBeGreaterThanOrEqual(3);
});

// ---------------------------------------------------------------------------
// option merging
// ---------------------------------------------------------------------------

test("config targets enable the /connect bridge", () => {
    const options = parse([], emptyEnv, { connect: { targets: [{ namespace: "ddz" }] } });
    expect(options.connect).toBe(true);
    expect(options.connectTargets.map((target) => target.namespace)).toEqual(["ddz"]);
});

test("config values are overridden by env, which is overridden by the CLI", () => {
    const config = { host: "config-host", port: 1111, connect: { port: 1112 } };

    expect(parse([], emptyEnv, config).host).toBe("config-host");
    expect(parse([], { HOST: "env-host" }, config).host).toBe("env-host");
    expect(parse(["--host", "cli-host"], { HOST: "env-host" }, config).host).toBe("cli-host");

    expect(parse([], emptyEnv, config).port).toBe(1111);
    expect(parse([], { PORT: "2222" }, config).port).toBe(2222);
    expect(parse(["--port", "3333"], { PORT: "2222" }, config).port).toBe(3333);

    expect(parse([], emptyEnv, config).connectPort).toBe(1112);
    expect(parse(["--connect-port", "3333"], emptyEnv, config).connectPort).toBe(3333);
});

test("--pack replaces the configured target list rather than appending", () => {
    const config = { connect: { targets: [{ namespace: "ddz" }, { namespace: "game" }] } };
    const options = parse(["--connect", "--pack", "other"], emptyEnv, config);
    expect(options.connectTargets.map((target) => target.namespace)).toEqual(["other"]);
});

test("--pack is repeatable and deduplicated", () => {
    const options = parse(["--connect", "--pack", "ddz", "--pack", "game", "--pack", "ddz"]);
    expect(options.connectTargets.map((target) => target.namespace)).toEqual(["ddz", "game"]);
});

test("an invalid --pack is ignored, not fatal", () => {
    const options = parse(["--connect", "--pack", "Bad-Namespace", "--pack", "ddz"]);
    expect(options.connectTargets.map((target) => target.namespace)).toEqual(["ddz"]);
});

test("the bridge may listen without any configured pack", () => {
    // This is a usable state (the operator connects first and fixes the config
    // after), so it must not be rejected at startup.
    const options = parse(["--connect"]);
    expect(options.connect).toBe(true);
    expect(options.connectTargets).toEqual([]);
});
