import { fail, redirect } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { resolve } from "$app/paths";
import { MAX_TEAMSIZE, MAX_MINUTES, MAX_GOAL_TARGET } from "$lib/engine/rules";
import { createRoom, getRoom } from "$lib/server/game/rooms.server";
import type { Actions } from "./$types";

export const actions = {
  createRoom: async ({ request, cookies }) => {
    const data = await request.formData();
    const numPlayers = Number(data.get("numPlayers"));
    const kind = data.get("kind");
    const value = Number(data.get(kind === "time" ? "minutes" : "target"));
    const username = data.get("username");

    if (typeof username !== "string" || !username.trim() || username.length > 20) {
      return fail(400, { message: "Username must contain 1–20 characters and cannot be blank." });
    }

    if (!Number.isInteger(numPlayers) || numPlayers < 1 || numPlayers > MAX_TEAMSIZE) {
      return fail(400, { message: "Invalid number of players per team." });
    }
    if ((kind !== "time" && kind !== "goals") || !Number.isInteger(value) || value < 1 ||
        value > (kind === "time" ? MAX_MINUTES : MAX_GOAL_TARGET)) {
      return fail(400, { message: "Invalid match rules." });
    }

    const rules = kind === "time"
      ? { kind, minutes: value } as const
      : { kind, target: value } as const;
    const room = createRoom(rules, numPlayers, username.trim());
    const token = room.players[0].token;
    cookies.set(`room_${room.code}`, token, { path: "/", httpOnly: true, sameSite: "strict", secure: !dev });
    redirect(303, resolve("/lobby/online/[code]", { code: room.code }));
  },

  joinRoom: async ({ request, cookies }) => {
    const data = await request.formData();
    const username = data.get("username");
    if (typeof username !== "string" || !username.trim() || username.length > 20) {
      return fail(400, { message: "Username must contain 1–20 characters and cannot be blank." });
    }
    const code = data.get("roomCode");
    const room = typeof code === "string" ? getRoom(code.trim()) : undefined;
    if (!room) {
      return fail(404, { message: "Room not found. Check the code and try again." });
    }
    const existing = room.players.find(p => p.token === cookies.get(`room_${room.code}`));
    const player = existing ?? room.addPlayer(username.trim());
    if (!player) return fail(400, { message: "Room is full." });
    const token = player.token;
    cookies.set(`room_${room.code}`, token, { path: "/", httpOnly: true, sameSite: "strict", secure: !dev });
    redirect(303, resolve("/lobby/online/[code]", { code: room.code }));
  }
} satisfies Actions;
