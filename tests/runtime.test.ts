import { beforeEach, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  nativeExpoGo: false,
  constants: { executionEnvironment: "bare", appOwnership: null },
}));
vi.mock("expo", () => ({ isRunningInExpoGo: () => runtime.nativeExpoGo }));
vi.mock("expo-constants", () => ({
  default: runtime.constants,
  ExecutionEnvironment: { StoreClient: "storeClient" },
}));
import { isExpoGoRuntime } from "../apps/mobile/native/runtime";

beforeEach(() => {
  runtime.nativeExpoGo = false;
  runtime.constants.executionEnvironment = "bare";
});
it("recognizes Expo Go even when deprecated appOwnership is null", () => {
  runtime.nativeExpoGo = true;
  expect(isExpoGoRuntime()).toBe(true);
});
it("recognizes the store-client environment without the native probe", () => {
  runtime.constants.executionEnvironment = "storeClient";
  expect(isExpoGoRuntime()).toBe(true);
});
it("allows the native development build", () => {
  expect(isExpoGoRuntime()).toBe(false);
});
it("allows the standalone build", () => {
  runtime.constants.executionEnvironment = "standalone";
  expect(isExpoGoRuntime()).toBe(false);
});
