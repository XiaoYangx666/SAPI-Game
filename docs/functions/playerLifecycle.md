[**BEGame**](../README.md)

***

# Function: playerLifecycle()

```ts
playerLifecycle<P extends GamePlayer, TData>(
    options: PlayerLifecycleOptions<P, TData>
): PlayerLifecycleOptions<P, TData>
```

用于在 `addComponent(PlayerLifecycle, ...)` 时从 `players` 推导玩家和队伍 data 类型。
