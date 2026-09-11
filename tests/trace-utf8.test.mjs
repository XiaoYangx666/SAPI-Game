import { expect, test } from "vitest";
import { BinaryReader, BinaryWriter } from "../packages/trace-core/dist/binary.js";

const wellFormed = [
    "",
    "ASCII only 123",
    "中文测试",
    "éèêë ñ ü ĀƁ",
    "emoji 🎮😀🚀",
    "\u0000\u007f\u0080\u07ff\u0800\uffff",
    "mixed 中🎮 done",
];

function writeString(value) {
    const writer = new BinaryWriter();
    writer.writeString(value);
    return writer.toUint8Array();
}

function readString(bytes) {
    const reader = new BinaryReader(bytes);
    const value = reader.readString();
    expect(reader.remaining).toBe(0);
    return value;
}

test("trace-core UTF-8 encoder matches TextEncoder byte-for-byte", () => {
    const encoder = new TextEncoder();
    for (const value of wellFormed) {
        const encoded = writeString(value);
        const reference = encoder.encode(value);
        expect(encoded.subarray(encoded.length - reference.length)).toEqual(
            reference
        );
        expect(readString(encoded)).toBe(value);
    }
});

test("trace-core UTF-8 round-trips unpaired surrogates for legacy compatibility", () => {
    for (const value of ["\ud83d", "\udc00", "a\ud800b"]) {
        expect(readString(writeString(value))).toBe(value);
    }
});

test("trace-core UTF-8 decoder rejects corrupted byte streams", () => {
    expect(() => readString(Uint8Array.from([1, 0x80]))).toThrow(
        /Invalid UTF-8 leading byte/
    );
    expect(() => readString(Uint8Array.from([2, 0xc3, 0x28]))).toThrow(
        /Invalid UTF-8 continuation byte/
    );
    expect(() => readString(Uint8Array.from([1, 0xc3]))).toThrow(
        /Unexpected end of trace string/
    );
    expect(
        () => readString(Uint8Array.from([4, 0xf7, 0xbf, 0xbf, 0xbf]))
    ).toThrow(/Invalid UTF-8 code point/);
});
