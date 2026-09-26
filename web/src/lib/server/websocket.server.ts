import { WebSocketServer } from "ws";

export function startWebSocketServer() {
  const wss = new WebSocketServer({
    port: 8080,
  });

  wss.on("connection", (ws) => {
    console.log("Client connected");

    ws.send("test");

    ws.on("message", (data) => {
      const message = data.toString();

      console.log("Received from client:", message);  
    });

    ws.on("close", () => {
      console.log("Client disconnected");
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
    });
  });

  return wss;
};
