[**BEGame**](../README.md)

***

# Interface: SpawnBinding<P, TData>

- `players: PlayerSource<P, TData>`
- `position: Vector3 | (() => Vector3 | undefined)`

若玩家同时存在于多个 binding，第一个 binding 优先。
