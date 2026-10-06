import { fail, redirect } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { resolve } from "$app/paths";
import { MAX_TEAMSIZE, MAX_MINUTES, MAX_GOAL_TARGET } from "$lib/engine/rules";
import { createRoom, getRoom } from "$lib/server/game/rooms.server";
import type { Actions } from "./$types";

export const actions = {
  createRoom: async ({ request, cookies }) => {
    const data = await request.formData();
    const username = data.get("username");

    if (typeof username !== "string" || !username.trim() || username.length > 20) {
      return fail(400, { message: "Invalid username."});
    }

    const room = createRoom();
    const token = room.getToken(room.adminId);
    if(!token) return fail(500, "Failed to create admin token");

    cookies.set(`room_${room.code}`, token, { path: "/", httpOnly: true, sameSite: "strict", secure: !dev });
    redirect(303, resolve("/lobby/online/[code]", { code: room.code }));
  },

  joinRoom: async ({ request, cookies }) => {
    const data = await request.formData();
    const username = data.get("username");

    if (typeof username !== "string" || !username.trim() || username.length > 20) {
      return fail(400, { message: "Invalid username."});
    }

    const code = data.get("roomCode");
    const room = typeof code === "string" ? getRoom(code.trim()) : undefined;
    if (!room) {
      return fail(404, { message: "Room not found."});
    }

    const {clientId, client} = room.findClient(cookies.get(`room_${room.code}`)) ?? room.addClient(username);
    const token = room.getToken(clientId);
    if(!token) return fail(500, "No token corresponding to client ID.");
    
    cookies.set(`room_${room.code}`, token, { path: "/", httpOnly: true, sameSite: "strict", secure: !dev });
    redirect(303, resolve("/lobby/online/[code]", { code: room.code }));
  }
} satisfies Actions;
