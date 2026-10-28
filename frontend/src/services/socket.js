import { io } from "socket.io-client";

export function connectSocket(token) {
  return io(import.meta.env.VITE_SOCKET_URL || "http://localhost:5000", {
    auth: { token },
    transports: ["websocket", "polling"]
  });
}
