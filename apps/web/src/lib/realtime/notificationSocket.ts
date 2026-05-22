import { io, type Socket } from "socket.io-client";

// socket.io is mounted on the bare HTTP server, not under /api/v1.
const SOCKET_BASE_URL = (() => {
  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";
  return apiUrl.replace(/\/api\/v\d+\/?$/, "");
})();

const getStoredAccessToken = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("travenest-auth");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { token?: string } };
    return parsed.state?.token ?? null;
  } catch {
    return null;
  }
};

type Listener = () => void;

// Ref-counted singleton: one connection serves the header bell and the
// notification list together. The backend joins every socket to `user:<id>`,
// so a `notification:new` emit reaches the viewer without any room join.
let socket: Socket | null = null;
const listeners = new Set<Listener>();

const handleNotification = (): void => {
  listeners.forEach((listener) => listener());
};

const ensureSocket = (): void => {
  if (socket) return;
  const token = getStoredAccessToken();
  socket = io(SOCKET_BASE_URL, {
    withCredentials: true,
    transports: ["websocket", "polling"],
    auth: token ? { token } : undefined,
  });
  socket.on("notification:new", handleNotification);
};

const teardownSocket = (): void => {
  if (socket && listeners.size === 0) {
    socket.off("notification:new", handleNotification);
    socket.disconnect();
    socket = null;
  }
};

/**
 * Subscribe to live `notification:new` events. Returns an unsubscribe function;
 * the underlying socket disconnects once the last subscriber leaves.
 */
export const subscribeToNotifications = (
  listener: Listener,
): (() => void) => {
  listeners.add(listener);
  ensureSocket();
  return () => {
    listeners.delete(listener);
    teardownSocket();
  };
};
