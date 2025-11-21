[**SAPI-Game**](../../../../README.md)

***

[SAPI-Game](../../../../globals.md) / [Utils](../README.md) / Duration

# Class: Duration

## Constructors

### Constructor

> **new Duration**(`ticks`): `Duration`

#### Parameters

##### ticks

`number`

#### Returns

`Duration`

## Properties

### ticksPerMinute

> `readonly` `static` **ticksPerMinute**: `number`

***

### ticksPerSecond

> `readonly` `static` **ticksPerSecond**: `20` = `20`

## Accessors

### ticks

#### Get Signature

> **get** **ticks**(): `number`

获取持续时间的刻数

##### Returns

`number`

## Methods

### toSeconds()

> **toSeconds**(): `number`

#### Returns

`number`

***

### fromMinutes()

> `static` **fromMinutes**(`minutes`): `Duration`

#### Parameters

##### minutes

`number`

#### Returns

`Duration`

***

### fromSeconds()

> `static` **fromSeconds**(`seconds`): `Duration`

#### Parameters

##### seconds

`number`

#### Returns

`Duration`
