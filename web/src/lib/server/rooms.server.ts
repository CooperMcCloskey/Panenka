import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("1234567890ABCDEFGHJKLMNPQRSTUVWXYZ", 6);
// Generates a room code
function genCode() {
    return nanoid();
}

let gameCode = genCode();



