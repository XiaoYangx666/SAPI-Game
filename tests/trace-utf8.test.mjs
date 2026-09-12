import { expect, test } from "vitest";
import {
    BinaryReader,
    BinaryWriter,
    truncateUtf8,
    utf8ByteLength,
} from "../packages/trace-core/dist/binary.js";

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

test("utf8ByteLength matches the trace UTF-8 encoder", () => {
    const encoder = new TextEncoder();
    for (const value of [...wellFormed, "中文🎮mixed"]) {
        expect(utf8ByteLength(value)).toBe(encoder.encode(value).length);
    }
    // Unpaired surrogates are 3 raw bytes, matching the legacy encoder behavior.
    expect(utf8ByteLength("\ud83d")).toBe(3);
    expect(utf8ByteLength("a\ud800b")).toBe(5);
});

test("truncateUtf8 stays within the byte budget and never splits surrogate pairs", () => {
    const encoder = new TextEncoder();
    const samples = [...wellFormed, "中文🎮mixed"];
    for (const value of samples) {
        for (const limit of [0, 1, 2, 3, 4, 5, 8, 16]) {
            const truncated = truncateUtf8(value, limit);
            expect(encoder.encode(truncated).length).toBeLessThanOrEqual(limit);
            expect(value.startsWith(truncated)).toBe(true);
        }
    }

    expect(truncateUtf8("🎮x", 3)).toBe("");
    expect(truncateUtf8("🎮x", 4)).toBe("🎮");
    expect(truncateUtf8("a🎮x", 5)).toBe("a🎮");
    expect(truncateUtf8("中", 2)).toBe("");
    expect(truncateUtf8("中", 3)).toBe("中");
});
