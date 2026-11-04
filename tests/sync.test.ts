import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ network: vi.fn(), authorized: vi.fn() }));
vi.mock("expo-network", () => ({ getNetworkStateAsync: mocks.network }));
vi.mock("expo-file-system/legacy", () => ({}));
vi.mock("../apps/mobile/features/auth", () => ({
  api: {},
  authorized: mocks.authorized,
  useAuth: { getState: () => ({ user: null }) },
}));
vi.mock("../apps/mobile/database", () => ({
  db: vi.fn(),
  markSync: vi.fn(),
  getDocument: vi.fn(),
  persist: vi.fn(),
  root: "file:///test/",
  setting: vi.fn(),
  setSetting: vi.fn(),
}));
vi.mock("../apps/mobile/store", () => ({
  useSettings: { getState: () => ({ backup: true }) },
}));
import { sync } from "../apps/mobile/features/sync";
beforeEach(() => vi.clearAllMocks());
it("rejects a concurrent sync while connectivity is still being checked and releases the lock on failure", async () => {
  let resolveNetwork!: (value: { isConnected: boolean }) => void;
  mocks.network.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveNetwork = resolve;
      }),
  );
  const first = sync();
  const failed = expect(first).rejects.toThrow("offline");
  await expect(sync()).rejects.toThrow("already running");
  expect(mocks.network).toHaveBeenCalledTimes(1);
  resolveNetwork({ isConnected: false });
  await failed;
  mocks.network.mockResolvedValueOnce({ isConnected: false });
  await expect(sync()).rejects.toThrow("offline");
  expect(mocks.network).toHaveBeenCalledTimes(2);
  expect(mocks.authorized).not.toHaveBeenCalled();
});
