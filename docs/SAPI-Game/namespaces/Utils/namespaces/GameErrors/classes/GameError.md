[**SAPI-Game**](../../../../../../README.md)

***

[SAPI-Game](../../../../../../globals.md) / [Utils](../../../README.md) / [GameErrors](../README.md) / GameError

# Class: GameError

## Extends

- `Error`

## Extended by

- [`GameManagerError`](GameManagerError.md)
- [`GameEngineError`](GameEngineError.md)
- [`GameStateError`](GameStateError.md)

## Constructors

### Constructor

> **new GameError**(`mes`, `options?`): `GameError`

#### Parameters

##### mes

`string`

##### options?

`ErrorOptions`

#### Returns

`GameError`

#### Overrides

`Error.constructor`

## Properties

### cause?

> `optional` **cause**: `unknown`

#### Inherited from

`Error.cause`

***

### message

> **message**: `string`

#### Inherited from

`Error.message`

***

### name

> **name**: `string`

#### Inherited from

`Error.name`

***

### stack?

> `optional` **stack**: `string`

#### Inherited from

`Error.stack`

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

`Error.isError`
