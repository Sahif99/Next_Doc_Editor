const { createServer } = require("node:http");
const next = require("next");
const { Server } = require("socket.io");

const port = Number.parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

const MAX_SOCKET_PAYLOAD_BYTES = 260_000;
const SOCKET_WINDOW_MS = 10_000;
const SOCKET_MAX_EVENTS = 60;

function sanitizeDocumentHtml(value) {
  if (typeof value !== "string") return "";

  return value
    .replace(/<\s*\/?\s*(script|style|iframe|object|embed|meta|link|form|input|button|svg|math)[^>]*>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "")
    .replace(/\s+style\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "")
    .replace(/\s+(href|src)\s*=\s*(['"]?)\s*(javascript:|data:text\/html|vbscript:)[^'"\s>]*/gi, "");
}

function isSocketPayloadAllowed(socket) {
  const now = Date.now();
  const bucket = socket.data.rateBucket || {
    count: 0,
    resetAt: now + SOCKET_WINDOW_MS,
  };

  if (bucket.resetAt <= now) {
    bucket.count = 0;
    bucket.resetAt = now + SOCKET_WINDOW_MS;
  }

  bucket.count += 1;
  socket.data.rateBucket = bucket;

  return bucket.count <= SOCKET_MAX_EVENTS;
}

function normalizeSocketUpdate(payload) {
  const serializedSize = Buffer.byteLength(JSON.stringify(payload || {}), "utf8");

  if (serializedSize > MAX_SOCKET_PAYLOAD_BYTES) {
    return null;
  }

  return {
    ...payload,
    title:
      typeof payload?.title === "string"
        ? payload.title.trim().slice(0, 120)
        : undefined,
    content:
      typeof payload?.content === "string"
        ? sanitizeDocumentHtml(payload.content)
        : undefined,
    revision:
      typeof payload?.revision === "number" && Number.isFinite(payload.revision)
        ? payload.revision
        : undefined,
    live: Boolean(payload?.live),
    user: {
      id: typeof payload?.user?.id === "string" ? payload.user.id.slice(0, 80) : "",
      name: typeof payload?.user?.name === "string" ? payload.user.name.slice(0, 80) : "User",
    },
  };
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  const io = new Server(httpServer, {
    path: "/api/socket",
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
    },
  });

  const roomUsers = new Map();

  io.on("connection", (socket) => {
    socket.on("document:join", ({ documentId, user }) => {
      if (typeof documentId !== "string" || documentId.length > 80) {
        socket.emit("sync:rejected", { reason: "invalid-room" });
        return;
      }

      socket.join(documentId);
      const users = roomUsers.get(documentId) || new Map();
      users.set(socket.id, {
        id: typeof user?.id === "string" ? user.id.slice(0, 80) : socket.id,
        name: typeof user?.name === "string" ? user.name.slice(0, 80) : "User",
      });
      roomUsers.set(documentId, users);
      const joinedUser = users.get(socket.id);
      socket.emit("presence:list", Array.from(users.values()).filter((item) => item?.id !== joinedUser?.id));
      socket.to(documentId).emit("presence:join", joinedUser);
    });

    socket.on("document:update", ({ documentId, payload }) => {
      if (!isSocketPayloadAllowed(socket)) {
        socket.emit("sync:rejected", { reason: "rate-limit" });
        return;
      }

      if (typeof documentId !== "string" || !socket.rooms.has(documentId)) {
        socket.emit("sync:rejected", { reason: "room-required" });
        return;
      }

      const normalizedPayload = normalizeSocketUpdate(payload);

      if (!normalizedPayload) {
        socket.emit("sync:rejected", { reason: "payload-too-large" });
        return;
      }

      socket.to(documentId).emit("document:update", normalizedPayload);
    });

    socket.on("document:cursor", ({ documentId, payload }) => {
      if (!isSocketPayloadAllowed(socket)) return;
      if (typeof documentId !== "string" || !socket.rooms.has(documentId)) return;
      socket.to(documentId).emit("document:cursor", payload);
    });

    socket.on("document:leave", ({ documentId, user }) => {
      socket.leave(documentId);
      const users = roomUsers.get(documentId);
      users?.delete(socket.id);
      if (users?.size === 0) roomUsers.delete(documentId);
      socket.to(documentId).emit("presence:leave", user);
    });

    socket.on("disconnecting", () => {
      socket.rooms.forEach((room) => {
        if (room === socket.id) return;
        const users = roomUsers.get(room);
        const user = users?.get(socket.id);
        users?.delete(socket.id);
        if (users?.size === 0) roomUsers.delete(room);
        socket.to(room).emit("presence:leave", user);
      });
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Next Docs ready on http://localhost:${port}`);
  });
});
