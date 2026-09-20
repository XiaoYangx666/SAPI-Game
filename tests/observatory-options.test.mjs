import { expect, test } from "vitest";
import { HELP_TEXT, parseServerOptions } from "../packages/observatory/server/options.ts";

const emptyEnv = {};

function parse(argv, env = emptyEnv) {
    const result = parseServerOptions(argv, env);
    if (!result.ok) throw new Error(result.error);
    return result.options;
}

test("only the HTTP workbench is on by default", () => {
    const options = parse([]);
    expect(options.http).toBe(true);
    expect(options.connect).toBe(false);
    expect(options.net).toBe(false);
    expect(options.ingest).toBe(false);
    expect(options.port).toBe(8787);
    expect(options.connectPort).toBe(18789);
    expect(options.netPort).toBe(18790);
});

test("bridges are opt-in and mutually exclusive", () => {
    expect(parse(["--connect"]).connect).toBe(true);
    expect(parse(["--net"]).net).toBe(true);

    const both = parseServerOptions(["--connect", "--net"], emptyEnv);
    expect(both.ok).toBe(false);
    if (!both.ok) expect(both.error).toMatch(/互斥|不能同时/);
});

test("ports, host and tokens are configurable", () => {
    const options = parse([
        "--port",
        "9000",
        "--host",
        "0.0.0.0",
        "--connect",
        "--connect-port",
        "19000",
        "--net-token",
        "secret",
    ]);
    expect(options.port).toBe(9000);
    expect(options.host).toBe("0.0.0.0");
    expect(options.connectPort).toBe(19000);
    expect(options.netToken).toBe("secret");
});

test("environment supplies values but never enables listeners", () => {
    const options = parse([], { PORT: "9999", BEGAME_NET_PORT: "18888", BEGAME_INGEST_TOKEN: "t" });
    expect(options.port).toBe(9999);
    expect(options.netPort).toBe(18888);
    expect(options.netToken).toBe("t");
    expect(options.net).toBe(false);
    expect(options.connect).toBe(false);
    expect(options.ingest).toBe(false);
});

test("--ingest-dir implies the ingest sink", () => {
    const options = parse(["--ingest-dir", "/tmp/x"]);
    expect(options.ingest).toBe(true);
    expect(options.ingestDir).toBe("/tmp/x");
});

test("a bridge-only process is allowed, an empty one is not", () => {
    const bridgeOnly = parse(["--no-http", "--net"]);
    expect(bridgeOnly.http).toBe(false);
    expect(bridgeOnly.net).toBe(true);

    const nothing = parseServerOptions(["--no-http"], emptyEnv);
    expect(nothing.ok).toBe(false);
    if (!nothing.ok) expect(nothing.error).toMatch(/没有任何可启动/);
});

test("invalid input reports an error, --help reports the help text", () => {
    const badPort = parseServerOptions(["--port", "abc"], emptyEnv);
    expect(badPort.ok).toBe(false);

    const unknown = parseServerOptions(["--nope"], emptyEnv);
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.error).toMatch(/未知参数/);

    const help = parseServerOptions(["--help"], emptyEnv);
    expect(help.ok).toBe(false);
    if (!help.ok) expect(help.error).toBe(HELP_TEXT);
});
