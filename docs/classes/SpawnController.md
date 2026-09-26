[**BEGame**](../README.md)

***

# Class: SpawnController

统一管理多组玩家到出生点的绑定。

## Options

- `dimension: Dimension`
- `bindings: SpawnBinding[]`
  - `players: PlayerSource`
  - `position: Vector3 | (() => Vector3 | undefined)`
- `autoSetSpawnPoint?: boolean`，默认 true
- `teleportOnAttach?: boolean`，默认 false
- `interval?: Duration`，默认 10 tick
- `safeArea?: SpawnSafeAreaOptions | false`

### safeArea

- `resetRadius?: Vector3`
- `maintainRadius?: Vector3 | false`
- `clearBlock?: string`，默认 air
- `floorBlock?: string`，默认 bedrock
- `resetOnAttach?: boolean`，默认 true
- `protectFloorInteraction?: boolean`，默认 true

## Methods

- `setSpawnPoints()`
- `teleportAll()`
- `resetSpawnAreas()`
- `maintainSpawnAreas()`

同一玩家异常存在于多个 binding 时，第一个 binding 优先。安全区重置会先统一 clear，再统一铺 floor，避免重叠区域互相清掉地板。

> `SpawnPointProtector` 是 deprecated 单 binding 兼容适配器。
