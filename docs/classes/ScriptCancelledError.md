[**SAPI-Game**](../README.md)

***

[SAPI-Game](../README.md) / ScriptCancelledError

# Class: ScriptCancelledError

## Extends

- `Error`

## Constructors

### Constructor

> **new ScriptCancelledError**(`id`): `ScriptCancelledError`

#### Parameters

##### id

`string`

#### Returns

`ScriptCancelledError`

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
