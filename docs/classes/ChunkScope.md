[**BEGame**](../README.md)

***

# Class: ChunkScope

将一组子组件的生命周期绑定到指定维度/坐标所在区块是否可访问。

## Options

- `dimensionId: DimensionIds`
- `pos: Vector3`
- `onLoad: (scope: ChunkScope) => void`
- `onUnload?: () => void`
- `interval?: Duration`，默认 20 tick

## Properties

- `isActive: boolean`

## Methods

### addComponent(component, options?, tag?)

在 Scope 内创建子组件。只有 attach 完整成功后才登记所有权。

### reload()

强制执行一次 unload → load，并返回当前 `ChunkScope`。

## 生命周期保证

- 区块卸载、reload、Scope detach 时按创建顺序逆序删除 owned components；
- `onLoad` 抛错时回滚本次已创建子组件并保持 inactive，后续检测可重试；
- 支持相同 Component type 配合不同 tag。

> `LazyLoader` 为 deprecated 兼容别名。
