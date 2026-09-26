[**BEGame**](../README.md)

***

# Interface: RegionBoundaryOptions<P, TData>

- `region: GameRegion`
- `players: PlayerSource<P, TData>`
- `interval?: Duration`
- `onEnter?: (player: P, group?: PlayerGroup<P, TData>) => void`
- `onLeave?: (player: P, group?: PlayerGroup<P, TData>) => void`

推荐通过 `regionBoundary(options)` 传给 `addComponent`，以保留泛型推导。
