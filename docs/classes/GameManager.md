[**SAPI-Game**](../README.md)

***

[SAPI-Game](../README.md) / GameManager

# Class: GameManager

## Constructors

### Constructor

> **new GameManager**(): `GameManager`

#### Returns

`GameManager`

## Methods

### buildKey()

> **buildKey**(`game`, `tag?`): `string`

#### Parameters

##### game

`Function`

##### tag?

`string`

#### Returns

`string`

***

### end()

> **end**(): `void`

静默停止所有普通游戏

#### Returns

`void`

***

### getGame()

> **getGame**\<`T`\>(`game`, `tag?`): `T` \| `undefined`

获取game

#### Type Parameters

##### T

`T` *extends* [`GameEngine`](GameEngine.md)\<`any`, `any`, `unknown`\>

#### Parameters

##### game

`classConstructor`\<`T`\>

##### tag?

`string`

#### Returns

`T` \| `undefined`

***

### getGameByKey()

> **getGameByKey**(`key`): [`GameEngine`](GameEngine.md)\<`any`, `any`, `unknown`\> \| `undefined`

#### Parameters

##### key

`string`

#### Returns

[`GameEngine`](GameEngine.md)\<`any`, `any`, `unknown`\> \| `undefined`

***

### hasGame()

> **hasGame**\<`T`\>(`game`, `tag?`): `boolean`

获取指定tag游戏是否已存在

#### Type Parameters

##### T

`T` *extends* [`GameEngine`](GameEngine.md)\<`any`, `any`, `unknown`\>

#### Parameters

##### game

`classConstructor`\<`T`\>

##### tag?

`string`

#### Returns

`boolean`

***

### startGame()

> **startGame**\<`T`\>(`game`, `config?`, `tag?`): `void`

启动指定游戏

#### Type Parameters

##### T

`T` *extends* [`GameEngine`](GameEngine.md)\<`any`, `any`, `any`\>

#### Parameters

##### game

`classConstructor`\<`T`\>

##### config?

`T` *extends* [`GameEngine`](GameEngine.md)\<`any`, `any`, `P`\> ? `P` : `unknown`

##### tag?

`string`

#### Returns

`void`

#### Throws

GameManagerError 当游戏已存在时

***

### status()

> **status**(`player?`, `detail?`): `void`

#### Parameters

##### player?

`Player`

##### detail?

`boolean`

#### Returns

`void`

***

### stopAll()

> **stopAll**(): `void`

停止所有普通游戏

#### Returns

`void`

***

### stopGame()

> **stopGame**\<`T`\>(`game`, `tag?`): `void`

#### Type Parameters

##### T

`T` *extends* [`GameEngine`](GameEngine.md)\<`any`, `any`, `unknown`\>

#### Parameters

##### game

`classConstructor`\<`T`\>

##### tag?

`string`

#### Returns

`void`

***

### stopGameByKey()

> **stopGameByKey**(`key`): `void`

#### Parameters

##### key

`string`

#### Returns

`void`
