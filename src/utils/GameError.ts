export class GameError extends Error {
    constructor(mes: string, options?: ErrorOptions) {
        super(mes, options);
        this.name = "GameError";
    }
}

export class GameManagerError extends GameError {
    constructor(mes: string, options?: ErrorOptions) {
        super(mes, options);
        this.name = this.constructor.name;
    }
}

export class GameEngineError extends GameError {
    constructor(mes: string, options?: ErrorOptions) {
        super(mes, options);
        this.name = this.constructor.name;
    }
}

export class GameStateError extends GameError {
    constructor(mes: string, options?: ErrorOptions) {
        super(mes, options);
        this.name = this.constructor.name;
    }
}
