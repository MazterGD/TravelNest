"use client";

import { useEffect, useRef } from "react";
import { subscribeToNotifications } from "@/lib/realtime/notificationSocket";

/**
 * Run `onNotification` whenever a live `notification:new` event arrives.
 * The callback is held in a ref (synced via an effect) so consumers can pass an
 * inline function without re-subscribing the socket on every render.
 */
export function useNotificationStream(onNotification: () => void): void {
  const callbackRef = useRef(onNotification);

  useEffect(() => {
    callbackRef.current = onNotification;
  });

  useEffect(() => {
    return subscribeToNotifications(() => callbackRef.current());
  }, []);
}
