import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  network: vi.fn(),
  authorized: vi.fn(),
  request: vi.fn(),
  post: vi.fn(),
  db: vi.fn(),
  getDocument: vi.fn(),
  setSetting: vi.fn(),
}));
vi.mock("expo-network", () => ({ getNetworkStateAsync: mocks.network }));
vi.mock("expo-file-system/legacy", () => ({}));
vi.mock("../apps/mobile/features/auth", () => ({
  api: { request: mocks.request, post: mocks.post },
  authorized: mocks.authorized,
  useAuth: { getState: () => ({ user: { id: "account" } }) },
}));
vi.mock("../apps/mobile/database", () => ({
  db: mocks.db,
  markSync: vi.fn(),
  getDocument: mocks.getDocument,
  persist: vi.fn(),
  root: "file:///test/",
  setting: vi.fn(),
  setSetting: mocks.setSetting,
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

it("reaches cloud recovery and reports failed uploads without losing the outbox entry", async () => {
  mocks.network.mockResolvedValueOnce({ isConnected: true });
  mocks.authorized.mockImplementation(async (operation) => operation());
  mocks.request
    .mockResolvedValueOnce({})
    .mockResolvedValueOnce({ items: [], cursor: "next", hasMore: false });
  mocks.post.mockRejectedValueOnce(new Error("Upload unavailable"));
  const runAsync = vi.fn();
  mocks.db.mockResolvedValueOnce({
    getAllAsync: async () => [{ documentId: "scan", revision: 1 }],
    runAsync,
  });
  mocks.getDocument.mockResolvedValueOnce({
    id: "scan",
    title: "Scan",
    revision: 1,
    remoteRevision: 0,
    pageCount: 1,
  });
  const progress = vi.fn();
  await sync(progress, true);
  expect(runAsync).toHaveBeenCalledWith(
    expect.stringContaining("attempts=attempts+1"),
    "Upload unavailable",
    "scan",
  );
  expect(mocks.request).toHaveBeenCalledWith("/sync/changes?limit=50");
  expect(mocks.setSetting).toHaveBeenCalledWith("cursor:account", "next");
  expect(progress).toHaveBeenLastCalledWith(
    "1 uploads need retry · 0 PDFs restored",
  );
});
