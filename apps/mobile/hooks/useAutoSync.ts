import { folioServerEnabled } from "../features/auth/serverMode";
import { useEffect } from "react";
import { AppState } from "react-native";
import * as Network from "expo-network";
import { create } from "zustand";
import { useSettings } from "../store";
import { useAuth } from "../features/auth";
import { sync } from "../features/sync";
export const useSyncStatus = create<{ message: string }>(() => ({
  message: "Cloud backup is off",
}));
export function useAutoSync() {
  const enabled = useSettings((s) => s.backup),
    user = useAuth((s) => s.user);
  useEffect(() => {
    if (!folioServerEnabled || !enabled || !user) {
      useSyncStatus.setState({ message: "Cloud backup is off" });
      return;
    }
    let stopped = false,
      inFlight = false,
      attempts = 0,
      timer: ReturnType<typeof setTimeout> | undefined;
    const run = async () => {
      if (stopped || inFlight) return;
      if (AppState.currentState !== "active") {
        timer = setTimeout(() => void run(), 60000);
        return;
      }
      inFlight = true;
      try {
        await sync((message) => useSyncStatus.setState({ message }));
        attempts = 0;
      } catch (e) {
        attempts = Math.min(attempts + 1, 5);
        useSyncStatus.setState({
          message: e instanceof Error ? e.message : "Backup will retry",
        });
      } finally {
        inFlight = false;
      }
      if (!stopped)
        timer = setTimeout(
          () => void run(),
          Math.min(300000, 30000 * 2 ** attempts),
        );
    };
    void run();
    const listener = Network.addNetworkStateListener((state) => {
      if (state.isConnected) {
        if (timer) clearTimeout(timer);
        void run();
      }
    });
    return () => {
      stopped = true;
      listener.remove();
      if (timer) clearTimeout(timer);
    };
  }, [enabled, user?.id]);
}
