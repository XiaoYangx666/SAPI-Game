import type { TraceValue } from "./types";

/** Bedrock-safe UTF-8 encoder. Platform APIs such as TextEncoder are not guaranteed there. */
function encodeUtf8(value: string) {
    const bytes: number[] = [];
    for (let index = 0; index < value.length; index++) {
        let code = value.charCodeAt(index);
        if (code < 0x80) {
            bytes.push(code);
        } else if (code < 0x800) {
            bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
        } else if (
            code >= 0xd800 &&
            code <= 0xdbff &&
            index + 1 < value.length &&
            (value.charCodeAt(index + 1) & 0xfc00) === 0xdc00
        ) {
            code =
                0x10000 +
                ((code & 0x3ff) << 10) +
                (value.charCodeAt(++index) & 0x3ff);
            bytes.push(
                0xf0 | (code >> 18),
                0x80 | ((code >> 12) & 0x3f),
                0x80 | ((code >> 6) & 0x3f),
                0x80 | (code & 0x3f)
            );
        } else {
            // Unpaired surrogates are encoded as their raw 3-byte code unit so that
            // traces written by the previous @protobufjs/utf8 implementation keep
            // round-tripping identically.
            bytes.push(
                0xe0 | (code >> 12),
                0x80 | ((code >> 6) & 0x3f),
                0x80 | (code & 0x3f)
            );
        }
    }
    return Uint8Array.from(bytes);
}

/** Bedrock-safe UTF-8 decoder. Strictly validates the byte stream. */
function decodeUtf8(bytes: Uint8Array) {
    const codeUnits: number[] = [];
    const parts: string[] = [];
    let offset = 0;
    const flush = () => {
        if (codeUnits.length === 0) return;
        parts.push(String.fromCharCode(...codeUnits));
        codeUnits.length = 0;
    };
    const continuation = () => {
        if (offset >= bytes.length) {
            throw new RangeError("Unexpected end of trace string");
        }
        const byte = bytes[offset++];
        if ((byte & 0xc0) !== 0x80) {
            throw new RangeError("Invalid UTF-8 continuation byte");
        }
        return byte & 0x3f;
    };

    while (offset < bytes.length) {
        const first = bytes[offset++];
        if (first < 0x80) {
            codeUnits.push(first);
        } else if ((first & 0xe0) === 0xc0) {
            codeUnits.push(((first & 0x1f) << 6) | continuation());
        } else if ((first & 0xf0) === 0xe0) {
            codeUnits.push(
                ((first & 0x0f) << 12) |
                    (continuation() << 6) |
                    continuation()
            );
        } else if ((first & 0xf8) === 0xf0) {
            const code =
                ((first & 0x07) << 18) |
                (continuation() << 12) |
                (continuation() << 6) |
                continuation();
            if (code > 0x10ffff) {
                throw new RangeError(`Invalid UTF-8 code point: ${code}`);
            }
            const surrogate = code - 0x10000;
            codeUnits.push(
                0xd800 | (surrogate >> 10),
                0xdc00 | (surrogate & 0x3ff)
            );
        } else {
            throw new RangeError(`Invalid UTF-8 leading byte: ${first}`);
        }
        if (codeUnits.length >= 1024) flush();
    }
    flush();
    return parts.join("");
}

export class BinaryWriter {
    private readonly data: number[] = [];

    get length() {
        return this.data.length;
    }

    writeByte(value: number) {
        this.data.push(value & 0xff);
    }

    writeBytes(value: Uint8Array) {
        for (const byte of value) this.data.push(byte);
    }

    writeVarUint(value: number) {
        if (!Number.isSafeInteger(value) || value < 0) {
            throw new RangeError(`varuint must be a non-negative safe integer: ${value}`);
        }
        let remaining = value;
        while (remaining >= 0x80) {
            this.writeByte((remaining % 0x80) | 0x80);
            remaining = Math.floor(remaining / 0x80);
        }
        this.writeByte(remaining);
    }

    writeVarInt(value: number) {
        if (!Number.isSafeInteger(value)) {
            throw new RangeError(`varint must be a safe integer: ${value}`);
        }
        this.writeVarUint(value >= 0 ? value * 2 : -value * 2 - 1);
    }

    writeFloat64(value: number) {
        const buffer = new ArrayBuffer(8);
        new DataView(buffer).setFloat64(0, value, true);
        this.writeBytes(new Uint8Array(buffer));
    }

    writeString(value: string) {
        const bytes = encodeUtf8(value);
        this.writeVarUint(bytes.length);
        this.writeBytes(bytes);
    }

    toUint8Array() {
        return Uint8Array.from(this.data);
    }
}

export class BinaryReader {
    private offset = 0;

    constructor(private readonly data: Uint8Array) {}

    get remaining() {
        return this.data.length - this.offset;
    }

    get position() {
        return this.offset;
    }

    readByte() {
        if (this.offset >= this.data.length) throw new RangeError("Unexpected end of trace");
        return this.data[this.offset++];
    }

    readBytes(length: number) {
        if (length < 0 || this.offset + length > this.data.length) {
            throw new RangeError("Unexpected end of trace");
        }
        const bytes = this.data.subarray(this.offset, this.offset + length);
        this.offset += length;
        return bytes;
    }

    readVarUint() {
        let result = 0;
        let multiplier = 1;
        for (let i = 0; i < 8; i++) {
            const byte = this.readByte();
            result += (byte & 0x7f) * multiplier;
            if ((byte & 0x80) === 0) {
                if (!Number.isSafeInteger(result)) throw new RangeError("Trace varuint overflow");
                return result;
            }
            multiplier *= 0x80;
        }
        throw new RangeError("Trace varuint is too long");
    }

    readVarInt() {
        const encoded = this.readVarUint();
        return encoded % 2 === 0 ? encoded / 2 : -(encoded + 1) / 2;
    }

    readFloat64() {
        const bytes = this.readBytes(8);
        return new DataView(bytes.buffer, bytes.byteOffset, 8).getFloat64(0, true);
    }

    readString() {
        const length = this.readVarUint();
        return decodeUtf8(this.readBytes(length));
    }
}

export enum RawValueTag {
    Null = 0,
    False = 1,
    True = 2,
    UInt = 3,
    Int = 4,
    Number = 5,
    String = 6,
    Array = 7,
    Object = 8,
}

export function writeRawValue(writer: BinaryWriter, value: TraceValue): void {
    if (value === null) {
        writer.writeByte(RawValueTag.Null);
        return;
    }
    if (value === false) {
        writer.writeByte(RawValueTag.False);
        return;
    }
    if (value === true) {
        writer.writeByte(RawValueTag.True);
        return;
    }
    if (typeof value === "number") {
        if (Number.isSafeInteger(value)) {
            if (value >= 0) {
                writer.writeByte(RawValueTag.UInt);
                writer.writeVarUint(value);
            } else {
                writer.writeByte(RawValueTag.Int);
                writer.writeVarInt(value);
            }
        } else {
            writer.writeByte(RawValueTag.Number);
            writer.writeFloat64(value);
        }
        return;
    }
    if (typeof value === "string") {
        writer.writeByte(RawValueTag.String);
        writer.writeString(value);
        return;
    }
    if (Array.isArray(value)) {
        writer.writeByte(RawValueTag.Array);
        writer.writeVarUint(value.length);
        for (const entry of value) writeRawValue(writer, entry);
        return;
    }

    writer.writeByte(RawValueTag.Object);
    const entries = Object.entries(value);
    writer.writeVarUint(entries.length);
    for (const [key, entry] of entries) {
        writer.writeString(key);
        writeRawValue(writer, entry);
    }
}

export function readRawValue(reader: BinaryReader): TraceValue {
    const tag = reader.readByte() as RawValueTag;
    switch (tag) {
        case RawValueTag.Null:
            return null;
        case RawValueTag.False:
            return false;
        case RawValueTag.True:
            return true;
        case RawValueTag.UInt:
            return reader.readVarUint();
        case RawValueTag.Int:
            return reader.readVarInt();
        case RawValueTag.Number:
            return reader.readFloat64();
        case RawValueTag.String:
            return reader.readString();
        case RawValueTag.Array: {
            const length = reader.readVarUint();
            const result: TraceValue[] = [];
            for (let i = 0; i < length; i++) result.push(readRawValue(reader));
            return result;
        }
        case RawValueTag.Object: {
            const length = reader.readVarUint();
            const result: Record<string, TraceValue> = {};
            for (let i = 0; i < length; i++) {
                result[reader.readString()] = readRawValue(reader);
            }
            return result;
        }
        default:
            throw new RangeError(`Unknown trace value tag: ${tag}`);
    }
}

export function concatBytes(parts: readonly Uint8Array[]) {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const result = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
        result.set(part, offset);
        offset += part.length;
    }
    return result;
}
