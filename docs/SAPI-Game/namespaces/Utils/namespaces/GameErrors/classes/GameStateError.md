[**SAPI-Game**](../../../../../../README.md)

***

[SAPI-Game](../../../../../../globals.md) / [Utils](../../../README.md) / [GameErrors](../README.md) / GameStateError

# Class: GameStateError

## Extends

- [`GameError`](GameError.md)

## Constructors

### Constructor

> **new GameStateError**(`mes`, `options?`): `GameStateError`

#### Parameters

##### mes

`string`

##### options?

`ErrorOptions`

#### Returns

`GameStateError`

#### Overrides

[`GameError`](GameError.md).[`constructor`](GameError.md#constructor)

## Properties

### cause?

> `optional` **cause**: `unknown`

#### Inherited from

[`GameError`](GameError.md).[`cause`](GameError.md#cause)

***

### message

> **message**: `string`

#### Inherited from

[`GameError`](GameError.md).[`message`](GameError.md#message)

***

### name

> **name**: `string`

#### Inherited from

[`GameError`](GameError.md).[`name`](GameError.md#name)

***

### stack?

> `optional` **stack**: `string`

#### Inherited from

[`GameError`](GameError.md).[`stack`](GameError.md#stack)

## Methods

### isError()

> `static` **isError**(`error`): `error is Error`

Indicates whether the argument provided is a built-in Error instance or not.

#### Parameters

##### error

`unknown`

#### Returns

`error is Error`

#### Inherited from

[`GameError`](GameError.md).[`isError`](GameError.md#iserror)
