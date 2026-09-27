import { error } from "@sveltejs/kit";
import { getRoom } from "$lib/server/game/rooms.server";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ params, cookies }) => {
  const room = getRoom(params.code);
  if (!room) error(404, "Room not found");
  const token = cookies.get(`room_${room.code}`);
  if (!token || !room.players.some(p => p.token === token)) error(403, "Join this room from the Online page first.");
  return { room: room.summary(), token };
};
