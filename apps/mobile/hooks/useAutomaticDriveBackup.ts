import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import {
  loadDriveConnection,
  syncDrive,
  useDriveBackup,
} from "../features/drive";

export function useAutomaticDriveBackup() {
  const account = useDriveBackup((state) => state.account);
  const automatic = useDriveBackup((state) => state.automatic);
  useEffect(() => {
    if (Platform.OS === "android")
      void loadDriveConnection().catch(() =>
        useDriveBackup.setState({
          status: "Could not load Drive backup settings.",
        }),
      );
  }, []);

  useEffect(() => {
    if (!account) return;
    if (!automatic) {
      void syncDrive(true);
      return;
    }
    const syncWhileOpen = () => {
      if (AppState.currentState === "active") void syncDrive();
    };
    syncWhileOpen();
    const timer = setInterval(syncWhileOpen, 120000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") syncWhileOpen();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [account?.id, automatic]);
}
