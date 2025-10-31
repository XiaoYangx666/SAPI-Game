[**SAPI-Game**](../README.md)

***

[SAPI-Game](../README.md) / EntityInteractionBlockerOptions

# Interface: EntityInteractionBlockerOptions

## Properties

### entityComponentTypes?

> `optional` **entityComponentTypes**: `EntityComponentTypes`[]

可选：要阻止的实体组件类型。
若设置，则仅阻止拥有该组件的实体。

***

### entityIds?

> `optional` **entityIds**: `string`[]

可选：要阻止交互的实体 ID 列表。
若不设置或为空，则阻止与所有实体交互。

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
