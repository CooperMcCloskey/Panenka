import { error, redirect } from "@sveltejs/kit";
import { getRoom } from "$lib/server/game/rooms.server";
import type { PageServerLoad } from "./$types";
import { resolve } from "path";

export const load: PageServerLoad = ({ params, cookies }) => {
  const room = getRoom(params.code);
  if (!room) error(404, "Room not found");
  const token = cookies.get(`room_${room.code}`);
  if (!token || !Object.keys(room.clients).some(p => p === token)) redirect(308, resolve("/online"));
  return { room: room.summary(), token };
};
