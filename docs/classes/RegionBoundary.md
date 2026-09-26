[**BEGame**](../README.md)

***

# Class: RegionBoundary

针对一个 `PlayerSource` 的区域边界观察器。

## 推荐用法

```ts
this.addComponent(
    RegionBoundary,
    regionBoundary({
        region,
        players: groupSet,
        onLeave(player, group) {},
        onEnter(player, group) {},
    })
);
```

## Options

- `region: GameRegion`
- `players: PlayerSource<P, TData>`
- `interval?: Duration`，默认 10 tick
- `onEnter?: (player, group?) => void`
- `onLeave?: (player, group?) => void`

首次扫描已在区域外的玩家会触发一次 `onLeave`。保持在区域外不会重复触发；重新进入后再次离开才会再次触发。玩家位于其它维度时视为区域外。

`regionBoundary(options)` 用于从 `players` 推导玩家和队伍 data 类型。

> `PlayerRegionMonitor` 是 deprecated 兼容适配器，并继续兼容旧 `groups:` 参数。
