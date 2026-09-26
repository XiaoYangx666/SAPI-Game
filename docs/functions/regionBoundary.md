[**BEGame**](../README.md)

***

# Function: regionBoundary()

```ts
regionBoundary<P extends GamePlayer, TData>(
    options: RegionBoundaryOptions<P, TData>
): RegionBoundaryOptions<P, TData>
```

用于在 `addComponent(RegionBoundary, ...)` 时从 `players` 保留 `P / TData` 推导。
