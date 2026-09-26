[**BEGame**](../README.md)

***

# Interface: PlayerLifecycleOptions<P, TData>

- `players: PlayerSource<P, TData>`
- `onDeath?: (context: PlayerDeathContext<P, TData>) => void`
- `onSpawn?: (context: PlayerSpawnContext<P, TData>) => void`

推荐通过 `playerLifecycle(options)` 使用，以从 `players` 推导泛型。
