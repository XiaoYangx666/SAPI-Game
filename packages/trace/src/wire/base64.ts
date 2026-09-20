const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const BASE64_PAD = "=";

const decodeTable = (() => {
    const table = new Int16Array(128);
    table.fill(-1);
    for (let i = 0; i < BASE64_ALPHABET.length; i++) {
        table[BASE64_ALPHABET.charCodeAt(i)] = i;
    }
    return table;
})();

/** Bedrock-safe Base64 encoder. Does not depend on Node Buffer or browser APIs. */
export function encodeBase64(bytes: Uint8Array): string {
    let result = "";
    for (let i = 0; i < bytes.length; i += 3) {
        const a = bytes[i];
        const hasB = i + 1 < bytes.length;
        const hasC = i + 2 < bytes.length;
        const b = hasB ? bytes[i + 1] : 0;
        const c = hasC ? bytes[i + 2] : 0;
        const value = (a << 16) | (b << 8) | c;

        result += BASE64_ALPHABET[(value >>> 18) & 63];
        result += BASE64_ALPHABET[(value >>> 12) & 63];
        result += hasB ? BASE64_ALPHABET[(value >>> 6) & 63] : BASE64_PAD;
        result += hasC ? BASE64_ALPHABET[value & 63] : BASE64_PAD;
    }
    return result;
}

/** Strict Base64 decoder shared by runtime storage and offline trace tooling. */
export function decodeBase64(value: string): Uint8Array {
    const text = value.replace(/\s+/g, "");
    if (text.length === 0) return new Uint8Array();
    if (text.length % 4 !== 0) throw new TypeError("Invalid Base64 length");

    let padding = 0;
    if (text.endsWith("==")) padding = 2;
    else if (text.endsWith("=")) padding = 1;

    const output = new Uint8Array((text.length / 4) * 3 - padding);
    let offset = 0;

    for (let i = 0; i < text.length; i += 4) {
        const c0 = decodeChar(text, i);
        const c1 = decodeChar(text, i + 1);
        const isLast = i + 4 === text.length;
        const c2 = text[i + 2] === BASE64_PAD ? 0 : decodeChar(text, i + 2);
        const c3 = text[i + 3] === BASE64_PAD ? 0 : decodeChar(text, i + 3);

        if (!isLast && (text[i + 2] === BASE64_PAD || text[i + 3] === BASE64_PAD)) {
            throw new TypeError("Invalid Base64 padding");
        }
        if (text[i + 2] === BASE64_PAD && text[i + 3] !== BASE64_PAD) {
            throw new TypeError("Invalid Base64 padding");
        }

        const bits = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
        if (offset < output.length) output[offset++] = (bits >>> 16) & 0xff;
        if (offset < output.length) output[offset++] = (bits >>> 8) & 0xff;
        if (offset < output.length) output[offset++] = bits & 0xff;
    }

    return output;
}

function decodeChar(text: string, index: number): number {
    const code = text.charCodeAt(index);
    if (code >= decodeTable.length || decodeTable[code] < 0) {
        throw new TypeError(`Invalid Base64 character at ${index}`);
    }
    return decodeTable[code];
}
