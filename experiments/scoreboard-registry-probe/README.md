# Scoreboard bridge-registry probe

Functional verification for the `/connect` bridge discovery mechanism. This
experiment deliberately stops before the trace export pipeline: it only proves
whether an external WebSocket client can see the fake-player entries that BEGame
packs write into a scoreboard objective.

## Background

Bedrock allows an add-on to register custom commands in exactly **one** namespace
(`CustomCommandErrorReason.NamespaceMismatch`), so a pack cannot register
`begame:tracelist` while its other commands live under `game:` or `ddz:`. Bridge
commands therefore use the pack's own namespace, and packs need a shared place to
advertise which namespace that is.

Scoreboard data is world-global and its participant list includes fake players,
which can carry long names. So each pack writes one participant into the
objective `begame_bridge`:

```
BEGAMEBRIDGE/1|<namespace>|<packName>|<packVersion>|<games>
```

An external `/connect` client runs `/scoreboard players list` and filters names
starting with `BEGAMEBRIDGE/1|`.

## What is already wired

- `@begame/trace/minecraft` exports `registerTraceConnectCommands(trace, { namespace, bridge })`.
  - `namespace` makes the commands `<namespace>:tracelist|traceinfo|tracepart`.
  - `bridge` publishes the registry entry after worldLoad.
- PartyGames calls it with `namespace: "game"` and a `bridge` advertisement.
- Dou Dizhu calls it with `namespace: "ddz"`.

## Run

```bash
node experiments/scoreboard-registry-probe/probe-server.cjs
```

Then, in Minecraft (operator, cheats on):

```
/connect ws://127.0.0.1:18789
```

The probe sends:

1. `/scoreboard objectives add begame_probe dummy`
2. `/scoreboard players set "PROBE|selfcheck|v1" begame_probe 1`
3. `/scoreboard objectives list`
4. `/scoreboard players list`

and prints the raw `commandResponse` payloads.

## What to look for

- Does `/scoreboard players list` return `PROBE|selfcheck|v1`? If not, fake
  players are not surfaced (or not supported) by this command and the registry
  needs a different carrier.
- Does it also return `BEGAMEBRIDGE/1|game|...` written by PartyGames? That is
  the actual discovery signal.
- Note the exact text/quoting/separators, because the client-side parser has to
  split this message.

If both appear, the next step is teaching the Observatory `ConnectBridge` to
read this registry and to call `<namespace>:tracelist` per discovered pack.
