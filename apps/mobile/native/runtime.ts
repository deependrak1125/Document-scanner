import { isRunningInExpoGo } from "expo";
import Constants, { ExecutionEnvironment } from "expo-constants";

export function isExpoGoRuntime(): boolean {
  // appOwnership is deprecated and may be null. Detect the actual Expo Go host.
  return (
    isRunningInExpoGo() ||
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient
  );
}
