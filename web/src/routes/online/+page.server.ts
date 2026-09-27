import { fail, redirect } from "@sveltejs/kit";
import { resolve } from "$app/paths";
import { MAX_PLAYERS, MAX_MINUTES, MAX_GOAL_TARGET } from "$lib/engine/rules";
import { createRoom, getRoom } from "$lib/server/game/rooms.server";
import type { Actions } from "./$types";

// TODO get the username and send it to the rooms file
export const actions = {
  createRoom: async ({ request }) => {
    const data = await request.formData();
    const numPlayers = Number(data.get("numPlayers"));
    const kind = data.get("kind");
    const value = Number(data.get(kind === "time" ? "minutes" : "target"));

    if (!Number.isInteger(numPlayers) || numPlayers < 1 || numPlayers > MAX_PLAYERS) {
      return fail(400, { message: "Invalid number of players per team." });
    }
    if ((kind !== "time" && kind !== "goals") || !Number.isInteger(value) || value < 1 ||
        value > (kind === "time" ? MAX_MINUTES : MAX_GOAL_TARGET)) {
      return fail(400, { message: "Invalid match rules." });
    }

    const rules = kind === "time"
      ? { kind, minutes: value } as const
      : { kind, target: value } as const;
    const room = createRoom(rules, numPlayers);
    redirect(303, resolve("/lobby/online/[code]", { code: room.code }));
  },

  joinRoom: async ({ request }) => {
    const data = await request.formData();
    const code = data.get("roomCode");
    const room = typeof code === "string" ? getRoom(code.trim()) : undefined;
    if (!room) {
      return fail(404, { message: "Room not found. Check the code and try again." });
    }
    redirect(303, resolve("/lobby/online/[code]", { code: room.code }));
  }
} satisfies Actions;
