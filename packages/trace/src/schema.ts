import type {
    TraceEventSchema,
    TraceFieldDefinition,
    TraceFieldType,
    TraceSchemaShape,
} from "./types";

export function optionalTraceField<T extends TraceFieldType>(
    type: T
): TraceFieldDefinition<T> & { readonly optional: true } {
    return { type, optional: true };
}

export function defineTraceEvent<const T extends TraceSchemaShape>(
    name: string,
    fields: T
): TraceEventSchema<T> {
    const normalizedName = name.trim();
    if (!normalizedName) throw new TypeError("Trace event name must not be empty");
    if (!/^[A-Za-z0-9_.:-]+$/.test(normalizedName)) {
        throw new TypeError(`Invalid trace event name: ${name}`);
    }
    return Object.freeze({ name: normalizedName, fields: Object.freeze({ ...fields }) });
}

export function normalizeTraceField(
    field: TraceFieldType | TraceFieldDefinition
): Required<TraceFieldDefinition> {
    return typeof field === "string"
        ? { type: field, optional: false }
        : { type: field.type, optional: field.optional ?? false };
}
