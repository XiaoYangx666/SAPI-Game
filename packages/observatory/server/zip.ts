/** Small ZIP writer for stored .begtrace files (STORE method, no dependencies). */
export function zipFiles(files: { name: string; bytes: Buffer }[]): Buffer {
    const local: Buffer[] = [];
    const central: Buffer[] = [];
    let offset = 0;
    for (const file of files) {
        const name = Buffer.from(file.name, "utf8");
        const crc = crc32(file.bytes);
        const header = Buffer.alloc(30);
        header.writeUInt32LE(0x04034b50, 0);
        header.writeUInt16LE(20, 4);
        header.writeUInt16LE(0x0800, 6);
        header.writeUInt32LE(crc, 14);
        header.writeUInt32LE(file.bytes.length, 18);
        header.writeUInt32LE(file.bytes.length, 22);
        header.writeUInt16LE(name.length, 26);
        local.push(header, name, file.bytes);

        const entry = Buffer.alloc(46);
        entry.writeUInt32LE(0x02014b50, 0);
        entry.writeUInt16LE(20, 4);
        entry.writeUInt16LE(20, 6);
        entry.writeUInt16LE(0x0800, 8);
        entry.writeUInt32LE(crc, 16);
        entry.writeUInt32LE(file.bytes.length, 20);
        entry.writeUInt32LE(file.bytes.length, 24);
        entry.writeUInt16LE(name.length, 28);
        entry.writeUInt32LE(offset, 42);
        central.push(entry, name);
        offset += header.length + name.length + file.bytes.length;
    }
    const centralSize = central.reduce((sum, bytes) => sum + bytes.length, 0);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(files.length, 8);
    end.writeUInt16LE(files.length, 10);
    end.writeUInt32LE(centralSize, 12);
    end.writeUInt32LE(offset, 16);
    return Buffer.concat([...local, ...central, end]);
}

function crc32(bytes: Buffer): number {
    let crc = 0xffffffff;
    for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
}
