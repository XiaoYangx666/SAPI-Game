[**SAPI-Game**](../README.md)

***

[SAPI-Game](../globals.md) / RunnerManager

# Class: RunnerManager

## Constructors

### Constructor

> **new RunnerManager**(`stateName`): `RunnerManager`

#### Parameters

##### stateName

`string`

#### Returns

`RunnerManager`

## Accessors

### size

#### Get Signature

> **get** **size**(): `number`

##### Returns

`number`

## Methods

### cancel()

> **cancel**(`id`): `boolean`

取消指定 runner 或 job

#### Parameters

##### id

`string`

#### Returns

`boolean`

***

### dispose()

> **dispose**(): `void`

取消所有 runner/job

#### Returns

`void`

***

### new()

> **new**(): `object`

返回一个新的scriptRunner(需手动捕获错误)

#### Returns

`object`

##### id

> **id**: `string`

##### runner

> **runner**: [`ScriptRunner`](ScriptRunner.md)

***

### run()

> **run**(`script`): `string`

运行普通脚本

#### Parameters

##### script

(`runner`) => `void` \| `Promise`\<`void`\>

#### Returns

`string`

***

### runDelay()

> **runDelay**(`script`, `ticks`): `string`

#### Parameters

##### script

(`runner`) => `void` \| `Promise`\<`void`\>

##### ticks

`number`

#### Returns

`string`

***

### runJob()

> **runJob**(`generator`): `object`

使用游戏 runJob 运行 generator

#### Parameters

##### generator

`Generator`\<`void`, `void`, `void`\>

#### Returns

`object`

##### id

> **id**: `string`

##### promise

> **promise**: `Promise`\<`void`\>
