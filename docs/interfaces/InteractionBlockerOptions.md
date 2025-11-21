[**SAPI-Game**](../README.md)

***

[SAPI-Game](../globals.md) / InteractionBlockerOptions

# Interface: InteractionBlockerOptions

## Properties

### blockComponentType?

> `optional` **blockComponentType**: `BlockComponentTypes`

可选：指定要阻止的方块组件类型（例如 BlockComponentTypes.Inventory）。
若不设置，则不按组件过滤。

***

### blockIds?

> `optional` **blockIds**: `string`[]

可选：指定要阻止交互的方块 ID 列表。
若不设置或为空，则表示不按 ID 限制。

***

### groupSet

> **groupSet**: [`PlayerGroupSet`](../classes/PlayerGroupSet.md)

被限制的玩家组

***

### message?

> `optional` **message**: `string`

可选：提示信息

***

### showMessage?

> `optional` **showMessage**: `boolean`

可选：是否给玩家提示（默认 true）
