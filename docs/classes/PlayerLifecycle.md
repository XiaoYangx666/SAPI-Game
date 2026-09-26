[**BEGame**](../README.md)

***

# Class: PlayerLifecycle

玩家 death/spawn 生命周期桥。它只把原生事件映射为当前游戏中的 `GamePlayer`、可选 `PlayerGroup` 和完整原生 event。

## 推荐用法

```ts
this.addComponent(
    PlayerLifecycle,
    playerLifecycle({
        players: this.context.groupSet,
        onDeath: ({ player, group, event }) => {},
        onSpawn: ({ player, group, event }) => {},
    })
);
```

## Options

- `players: PlayerSource<P, TData>`
- `onDeath?: (context: PlayerDeathContext<P, TData>) => void`
- `onSpawn?: (context: PlayerSpawnContext<P, TData>) => void`

死亡消息、生命数、装备、淘汰与传送等业务规则不属于本组件。

> `RespawnComponent` 是 deprecated 兼容适配器。
