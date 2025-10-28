[**SAPI-Game**](../../../../README.md)

***

[SAPI-Game](../../../../README.md) / [Utils](../README.md) / Algorithm

# Variable: Algorithm

> `const` **Algorithm**: `object`

## Type Declaration

### bfsBlocks()

> **bfsBlocks**: (`startBlock`, `condition`, `maxDistance`, `maxBlocks`) => `Block`[]

BFS 遍历方块

#### Parameters

##### startBlock

`Block`

起始方块

##### condition

(`block`, `distance`) => `boolean`

判断方块是否满足条件

##### maxDistance

`number` = `20`

可选，最大遍历距离

##### maxBlocks

`number` = `64`

#### Returns

`Block`[]

### linspace()

> **linspace**: (`start`, `end`, `num`) => `Vector3`[]

线性插值

#### Parameters

##### start

`Vector3`

##### end

`Vector3`

##### num

`number`

#### Returns

`Vector3`[]
