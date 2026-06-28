"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function useSocket(documentId: string, user: { id: string; name: string }) {
  const [connected, setConnected] = useState(false);
  const userId = user.id;
  const userName = user.name;

  useEffect(() => {
    const roomUser = {
      id: userId,
      name: userName,
    };

    socket = io({
      path: "/api/socket",
      transports: ["websocket", "polling"],
      autoConnect: true,
    });

    socket.on("connect", () => {
      setConnected(true);
      socket?.emit("document:join", { documentId, user: roomUser });
    });

    socket.on("disconnect", () => setConnected(false));

    return () => {
      socket?.emit("document:leave", { documentId, user: roomUser });
      socket?.disconnect();
      socket = null;
    };
  }, [documentId, userId, userName]);

  return {
    connected,
    emitUpdate(payload: unknown) {
      socket?.emit("document:update", { documentId, payload });
    },
    onUpdate(callback: (payload: any) => void) {
      socket?.on("document:update", callback);
      return () => {
        socket?.off("document:update", callback);
      };
    },
    onPresenceJoin(callback: (payload: any) => void) {
      socket?.on("presence:join", callback);
      return () => {
        socket?.off("presence:join", callback);
      };
    },
    onPresenceLeave(callback: (payload: any) => void) {
      socket?.on("presence:leave", callback);
      return () => {
        socket?.off("presence:leave", callback);
      };
    },
    onPresenceList(callback: (payload: any) => void) {
      socket?.on("presence:list", callback);
      return () => {
        socket?.off("presence:list", callback);
      };
    },
  };
}
