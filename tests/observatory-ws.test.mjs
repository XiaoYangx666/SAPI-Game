import { Duplex } from "node:stream";
import { expect, test } from "vitest";
import { RawWebSocketConnection } from "../packages/observatory/server/ws.ts";

function fakeSocket() {
    return new Duplex({
        read() {},
        write(_chunk, _encoding, callback) {
            callback();
        },
    });
}

test("a peer half-close without a close frame releases the connection", () => {
    const socket = fakeSocket();
    let closed = 0;
    const connection = new RawWebSocketConnection(
        socket,
        Buffer.alloc(0),
        () => {},
        () => {
            closed++;
        }
    );

    expect(connection.isOpen).toBe(true);
    // What the OS delivers when the remote process is killed: FIN, no frame.
    socket.emit("end");

    expect(connection.isOpen).toBe(false);
    expect(closed).toBe(1);

    // The later `close` must not fire the callback twice.
    socket.emit("close");
    expect(closed).toBe(1);
});

test("a close frame still releases the connection once", () => {
    const socket = fakeSocket();
    let closed = 0;
    const connection = new RawWebSocketConnection(
        socket,
        Buffer.alloc(0),
        () => {},
        () => {
            closed++;
        }
    );

    // Masked, empty close frame (opcode 8).
    connection["receive"](Buffer.from([0x88, 0x80, 0, 0, 0, 0]));

    expect(connection.isOpen).toBe(false);
    expect(closed).toBe(1);
});
