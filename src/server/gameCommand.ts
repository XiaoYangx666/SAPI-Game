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
import { GameManager } from "../system/gameManager";

export interface ServerGameCommandOptions {
    hub?: (player: Player) => void;
    onEnd?: () => void;
}

export function registerServerGameCommands(
    customCommandRegistry: CustomCommandRegistry,
    games: GameManager,
    options: ServerGameCommandOptions = {}
) {
    customCommandRegistry.registerEnum("game:opreation", [
        "start",
        "stop",
        "stopAll",
        "status",
        "end",
    ]);

    customCommandRegistry.registerCommand(
        {
            name: "game:game",
            description: "SAPIGame命令操作",
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
            operation: string,
            name: string,
            tag: string | undefined
        ) => handleGameCommand(games, options, origin, operation, name, tag)
    );

    const hubHandler = (origin: CustomCommandOrigin): CustomCommandResult => {
        const player =
            origin.sourceEntity instanceof Player ? origin.sourceEntity : undefined;
        if (!player) {
            return {
                message: "必须是玩家执行",
                status: CustomCommandStatus.Failure,
            };
        }

        games.leavePlayerFromAll(player.id);
        system.run(() => options.hub?.(player));
        return { message: "", status: CustomCommandStatus.Success };
    };

    for (const name of ["game:hub", "game:l"]) {
        customCommandRegistry.registerCommand(
            {
                name,
                description: "SAPIGame返回主城命令",
                permissionLevel: CommandPermissionLevel.Any,
            },
            hubHandler
        );
    }
}

function handleGameCommand(
    games: GameManager,
    options: ServerGameCommandOptions,
    origin: CustomCommandOrigin,
    operation: string,
    name: string | undefined,
    tag: string | undefined
): CustomCommandResult | undefined {
    const player =
        origin.sourceEntity instanceof Player ? origin.sourceEntity : undefined;

    switch (operation) {
        case "stopAll":
            system.run(() => games.stopAll());
            return {
                message: "已停止所有运行中的游戏",
                status: CustomCommandStatus.Success,
            };
        case "status":
            games.status(player, name === "detail");
            return undefined;
        case "stop":
            if (!name) return undefined;
            {
                const key = `${name}:${tag ?? 0}`;
                if (!games.getGameByKey(key)) {
                    return {
                        message: "游戏不存在",
                        status: CustomCommandStatus.Failure,
                    };
                }
                system.run(() => games.stopGameByKey(key));
                return {
                    message: `已停止游戏: ${key}`,
                    status: CustomCommandStatus.Success,
                };
            }
        case "end":
            system.run(() => {
                games.disposeAll();
                options.onEnd?.();
            });
            return undefined;
    }

    return undefined;
}
