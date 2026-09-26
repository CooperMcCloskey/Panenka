import { customAlphabet } from "nanoid";

// Generates a room code
function genCode() {
    const nanoid = customAlphabet("1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ", 6);
    return nanoid();
}

let gameCode = genCode();



