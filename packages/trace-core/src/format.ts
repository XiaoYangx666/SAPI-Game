export enum TraceRecordTag {
    StringDefinition = 1,
    PlayerDefinition = 2,
    StateDefinition = 3,
    ComponentDefinition = 4,
    SchemaDefinition = 5,
    Event = 16,
}

export enum TraceValueTag {
    Null = 0,
    False = 1,
    True = 2,
    UInt = 3,
    Int = 4,
    Number = 5,
    StringRef = 6,
    Array = 7,
    Object = 8,
    PlayerRef = 9,
}

export enum TraceSourceKindCode {
    Game = 0,
    State = 1,
    Component = 2,
    Runner = 3,
    Timer = 4,
    Participation = 5,
    Connection = 6,
    System = 7,
}

export enum TraceFieldTypeCode {
    Boolean = 0,
    UInt = 1,
    Int = 2,
    Number = 3,
    String = 4,
    Player = 5,
}
