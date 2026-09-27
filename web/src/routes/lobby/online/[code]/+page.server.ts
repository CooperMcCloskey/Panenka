import { error } from "@sveltejs/kit";
import { getRoom } from "$lib/server/game/rooms.server";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ params }) => {
  const room = getRoom(params.code);
  if (!room) error(404, "Room not found");
  return { room };
};
