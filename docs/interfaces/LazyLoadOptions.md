[**SAPI-Game**](../README.md)

***

[SAPI-Game](../README.md) / LazyLoadOptions

# Interface: LazyLoadOptions

## Properties

### dimensionId

> **dimensionId**: [`DimensionIds`](../SAPI-Game/namespaces/Utils/namespaces/vanilaData/enumerations/DimensionIds.md)

要检测的维度

***

### interval?

> `optional` **interval**: [`Duration`](../SAPI-Game/namespaces/Utils/classes/Duration.md)

检测间隔，默认 20 tick

***

### onLoad()

> **onLoad**: (`loader`) => `void`

加载时的回调（区块首次加载时触发）

#### Parameters

##### loader

[`LazyLoader`](../classes/LazyLoader.md)

#### Returns

`void`

***

### onUnload()?

> `optional` **onUnload**: () => `void`

卸载时的回调（区块卸载时触发）

#### Returns

`void`

***

### pos

> **pos**: `Vector3`

用于检测是否加载的方块坐标
