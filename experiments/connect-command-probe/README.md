# BEGame `/connect` custom-command probe

This behavior pack now also registers the BEGame trace bridge and records one
small test session when the world loads. The command response transport was
verified with the original probe and was not displayed in game chat.

## Test in Minecraft

1. The 0.2.0 behavior pack has been copied to Minecraft's development behavior
   packs. Re-enter the world so Minecraft loads the updated script.
2. Start the Observatory with `npm run observatory` from the repository root.
   The probe registers its commands under the `begame` namespace (the default),
   so the Observatory must be told about it — either add it to
   `observatory.config.json`:

   ```json
   { "connect": { "targets": { "begame": {} } } }
   ```

   or pass it on the command line: `npm run observatory -- --connect --pack begame`.
3. In Minecraft, run `/connect ws://127.0.0.1:18789`.
4. Open `http://127.0.0.1:8787`, choose **查看游戏会话**, and open the
   `connect-probe` test session. **批量导出 ZIP** downloads all stored sessions.

The old `node probe-server.cjs` checks `/begame:probe` and `/begame:chunk` only.
Stop it before starting Observatory because both listen on port 18789.

The server prints `PASS` only when `commandResponse.body.statusMessage` equals
the expected message byte for byte. `WRAPPED` means the expected data is intact
but appears inside additional response text. `FAIL` or `TIMEOUT` means this
candidate transport is not yet usable. The visible-chat result must be observed
in Minecraft separately.

This test uses unencrypted WebSocket on the local loopback address. It does not
test remote or `wss://` connections.
