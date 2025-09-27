import {
    CommandPermissionLevel,
    CustomCommandOrigin,
    CustomCommandParamType,
    CustomCommandRegistry,
    CustomCommandResult,
    CustomCommandStatus,
    Player,
    system,
} from "@minecraft/server";
import { Game } from "./main";

export function regGameCommand(customCommandRegistry: CustomCommandRegistry) {
    //注册枚举
    customCommandRegistry.registerEnum("game:opreation", [
        "start",
        "stop",
        "stopAll",
        "status",
        "end",
    ]);
    //注册命令
    customCommandRegistry.registerCommand(
        {
            name: "game:game",
            description: "SAPI-Game命令操作",
            permissionLevel: CommandPermissionLevel.GameDirectors,
            mandatoryParameters: [
                {
                    name: "game:opreation",
                    type: CustomCommandParamType.Enum,
                },
            ],
            optionalParameters: [
                { name: "gameName", type: CustomCommandParamType.String },
                { name: "gameTag", type: CustomCommandParamType.String },
            ],
        },
        (
            origin: CustomCommandOrigin,
            ope: string,
            name: string,
            tag: string | undefined
        ) => {
            return handleCommand(origin, ope, name, tag);
        }
    );
}

function handleCommand(
    origin: CustomCommandOrigin,
    ope: string,
    name: string | undefined,
    tag: string | undefined
): CustomCommandResult | undefined {
    const player =
        origin.sourceEntity instanceof Player ? origin.sourceEntity : undefined;
    switch (ope) {
        case "stopAll":
            system.run(() => {
                Game.manager.stopAll();
            });
            return {
                message: "已停止所有运行中的游戏",
                status: CustomCommandStatus.Success,
            };
        case "status":
            Game.manager.status(player, name === "detail");
            break;
        case "stop":
            if (name) {
                const key = `${name}:${tag ?? 0}`;
                const engine = Game.manager.getGameByKey(key);
                if (!engine)
                    return {
                        message: "游戏不存在",
                        status: CustomCommandStatus.Failure,
                    };
                system.run(() => {
                    Game.manager.stopGame(engine.constructor as any);
                });
                return {
                    message: `已停止游戏: ${key}`,
                    status: CustomCommandStatus.Success,
                };
            }
            break;
        case "end":
            system.run(() => {
                Game.manager.end();
            });
            break;
    }
    return undefined;
}
