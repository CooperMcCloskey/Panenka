import { error } from "@sveltejs/kit";
import { getRoom } from "$lib/server/game/roomManager.server";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ params, cookies }) => {
  const room = getRoom(params.code);
  if (!room) error(404, "Room not found");
  const token = cookies.get(`room_${room.code}`);
  const found = room?.findClient(token) ;
  if (!found) error(400, "Token not found");
  const {clientId, client} = found
  const {socket, ...rest} = client //separate out the socket from the rest because it cannot be serialized
  return {lobbyState: room.lobbyState, clientId, ...rest};
};
