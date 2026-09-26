[**BEGame**](../README.md)

***

# Function: initBEGame()

初始化 BEGame Core，不注册服务器命令或玩家跟踪。

```ts
import { initBEGame } from "@begame/core";

initBEGame({
    debugMode: true,
});
```

需要 `/game:hub`、`/game:end` 等服务器集成能力时使用 `initBEGameServer()`（`@begame/core/server`）。
