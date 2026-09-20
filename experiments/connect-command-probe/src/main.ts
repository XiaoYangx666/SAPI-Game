import {
  CommandPermissionLevel,
  CustomCommandParamType,
  CustomCommandStatus,
  system,
  world,
} from "@minecraft/server";
import { createTraceRuntime, registerTraceConnectCommands } from "@begame/trace/minecraft";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const allowedLengths = new Set([64, 512, 2048, 8192]);
const trace = createTraceRuntime({ packVersion: "connect-probe-0.2.0" });
trace.store.configure({ maxSessions: 100, maxBytes: 8 * 1024 * 1024, maxAgeMs: 30 * 24 * 60 * 60 * 1000 });
trace.store.enable();
registerTraceConnectCommands(trace);

world.afterEvents.worldLoad.subscribe(() => {
  system.run(() => {
    const session = trace.beginSession({ gameType: "connect-probe", gameKey: `connect-probe:${system.currentTick}` });
    if (!session) return;
    session.game.debug("Observatory 连接测试：游戏内生成的 trace 已可读取");
    session.game.debug("该示例只验证导出链路，不包含真实对局");
    trace.endSession(session.header.gameKey, "completed", "probe-ready");
  });
});

function makePayload(length: number): string {
  let state = 0x6b65_6761;
  let result = "";
  for (let index = 0; index < length; index++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    result += alphabet[state & 63];
  }
  return result;
}

system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
  customCommandRegistry.registerCommand(
    {
      name: "begame:probe",
      description: "Return a short WebSocket command response probe",
      permissionLevel: CommandPermissionLevel.GameDirectors,
    },
    () => ({
      status: CustomCommandStatus.Success,
      message: "BGPROBE:READY:0.1.0",
    }),
  );

  customCommandRegistry.registerCommand(
    {
      name: "begame:chunk",
      description: "Return a deterministic test payload of 64, 512, 2048 or 8192 characters",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      mandatoryParameters: [
        { name: "length", type: CustomCommandParamType.Integer },
      ],
    },
    (_origin, length: number) => {
      if (!allowedLengths.has(length)) {
        return {
          status: CustomCommandStatus.Failure,
          message: "BGPROBE:INVALID_LENGTH",
        };
      }
      return {
        status: CustomCommandStatus.Success,
        message: `BGPROBE:CHUNK:${length}:${makePayload(length)}:END`,
      };
    },
  );
});
