import { createHash } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  fetch: vi.fn(),
  list: vi.fn(),
  save: vi.fn(),
  read: vi.fn(),
  settings: new Map<string, unknown>(),
  silent: vi.fn(),
  current: vi.fn(),
}));
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("expo/fetch", () => ({ fetch: mock.fetch }));
vi.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  digest: async (_algorithm: string, bytes: Uint8Array) =>
    Uint8Array.from(createHash("sha256").update(bytes).digest()).buffer,
}));
vi.mock("../apps/mobile/native/runtime", () => ({
  isExpoGoRuntime: () => false,
}));
vi.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure: vi.fn(),
    signInSilently: mock.silent,
    getCurrentUser: mock.current,
    getTokens: async () => ({ accessToken: "test-token" }),
  },
}));
vi.mock("../apps/mobile/database", () => ({
  setting: async (key: string, fallback: unknown) =>
    mock.settings.get(key) ?? fallback,
  setSetting: async (key: string, value: unknown) => {
    mock.settings.set(key, value);
  },
  listDocuments: mock.list,
  savePdf: mock.save,
  readBytes: mock.read,
}));
import { syncDrive, useDriveBackup } from "../apps/mobile/features/drive";

const scopes = [
  "https://www.googleapis.com/auth/drive.appdata",
  "https://www.googleapis.com/auth/drive.file",
];
const user = { id: "test-account", email: "test@example.com" };
const pdf = Uint8Array.from(Buffer.from("%PDF-test"));
const hash = createHash("sha256").update(pdf).digest("hex");
const files = [
  {
    id: "drive-id",
    name: "Notes.pdf",
    size: String(pdf.length),
    modifiedTime: "2026-11-27T12:00:00Z",
    appProperties: { sha256: hash },
  },
];

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID", "test-client-id");
  mock.settings.clear();
  useDriveBackup.setState({ account: user, busy: false, status: "" });
  mock.silent.mockResolvedValue({
    type: "success",
    data: { user, scopes },
  });
  mock.current.mockReturnValue({ user });
  mock.list.mockResolvedValue([]);
});

it("restores a verified PDF and skips the same content on the next check", async () => {
  mock.fetch.mockImplementation(async (url: string) =>
    url.includes("alt=media") ? new Response(pdf) : Response.json({ files }),
  );
  mock.save.mockResolvedValue({ id: "local-id", uri: "file:///notes.pdf" });
  const before = useDriveBackup.getState().libraryRevision;
  await syncDrive();
  expect(mock.save).toHaveBeenCalledWith("Notes", pdf);
  expect(useDriveBackup.getState()).toMatchObject({
    libraryRevision: before + 1,
    files: [{ id: "drive-id", name: "Notes.pdf", hidden: false }],
  });
  expect(mock.settings.get("driveOwner:local-id")).toBe(user.id);
  mock.list.mockImplementation(async (_query, trash) =>
    trash
      ? []
      : [{ id: "local-id", uri: "file:///notes.pdf", fileSize: pdf.length }],
  );
  await syncDrive();
  expect(mock.save).toHaveBeenCalledTimes(1);
  expect(mock.read).not.toHaveBeenCalled();
});

it("rejects a corrupted Drive copy without saving it", async () => {
  mock.fetch.mockImplementation(async (url: string) =>
    url.includes("alt=media")
      ? new Response(new Uint8Array(pdf.length))
      : Response.json({ files }),
  );
  await syncDrive();
  expect(mock.save).not.toHaveBeenCalled();
  expect(useDriveBackup.getState().status).toContain("1 need retry");
});

it("makes no Drive requests when Google silently returns a different account", async () => {
  mock.silent.mockResolvedValue({
    type: "success",
    data: { user: { id: "other" }, scopes },
  });
  await syncDrive();
  expect(mock.fetch).not.toHaveBeenCalled();
  expect(useDriveBackup.getState().status).toContain("Reconnect");
});

it("uploads a regular PDF once and keeps private or other-account scans out of the upload", async () => {
  const docs = [
    {
      id: "regular",
      title: "Notes",
      uri: "file:///notes.pdf",
      fileSize: pdf.length,
    },
    {
      id: "private",
      title: "ID card",
      uri: "file:///card.pdf",
      fileSize: pdf.length,
      sensitive: true,
    },
    {
      id: "other",
      title: "Other account",
      uri: "file:///other.pdf",
      fileSize: pdf.length,
    },
  ];
  mock.settings.set("driveOwner:other", "previous-account");
  mock.list.mockImplementation(async (_query, trash) => (trash ? [] : docs));
  mock.read.mockResolvedValue(pdf);
  const location =
    "https://www.googleapis.com/upload/drive/v3/files?upload_id=test";
  mock.fetch
    .mockResolvedValueOnce(Response.json({ files: [] }))
    .mockResolvedValueOnce(Response.json({ files: [] }))
    .mockResolvedValueOnce(Response.json({ files: [] }))
    .mockResolvedValueOnce(Response.json({ id: "folio-folder" }))
    .mockResolvedValueOnce(Response.json({ files: [] }))
    .mockResolvedValueOnce(Response.json({ id: "documents-folder" }))
    .mockResolvedValueOnce(
      new Response(null, { headers: { Location: location } }),
    )
    .mockResolvedValueOnce(Response.json(files[0]))
    .mockResolvedValueOnce(Response.json({ files }))
    .mockResolvedValueOnce(Response.json({ files: [] }));
  await syncDrive();
  expect(mock.fetch).toHaveBeenCalledTimes(8);
  expect(useDriveBackup.getState().folderId).toBe("documents-folder");
  const create = mock.fetch.mock.calls[6][1];
  expect(JSON.parse(create.body)).toMatchObject({
    parents: ["documents-folder"],
    appProperties: { sha256: hash, folioRole: "document-v1" },
  });
  expect(mock.fetch).toHaveBeenCalledWith(
    location,
    expect.objectContaining({ method: "PUT", body: pdf }),
  );
  expect(mock.read).not.toHaveBeenCalledWith("file:///card.pdf");
  expect(mock.settings.get("driveOwner:regular")).toBe(user.id);
  await syncDrive();
  expect(mock.fetch).toHaveBeenCalledTimes(10);
  expect(mock.save).not.toHaveBeenCalled();
});

it("leaves Drive backups visible when the local PDF is moved to Trash", async () => {
  mock.list.mockImplementation(async (_query, trash) =>
    trash
      ? [
          {
            id: "trashed",
            title: "Notes",
            uri: "file:///notes.pdf",
            fileSize: pdf.length,
            deletedAt: "2026-11-27",
          },
        ]
      : [],
  );
  mock.read.mockResolvedValue(pdf);
  mock.fetch.mockImplementation(async () => Response.json({ files }));
  await syncDrive();
  expect(mock.fetch).toHaveBeenCalledTimes(2);
  expect(mock.fetch.mock.calls.every(([, init]) => !init.method)).toBe(true);
  expect(mock.save).not.toHaveBeenCalled();
  expect(useDriveBackup.getState().files).toEqual([
    {
      id: "drive-id",
      name: "Notes.pdf",
      hidden: false,
      size: pdf.length,
      modifiedTime: files[0].modifiedTime,
    },
  ]);
});

it("refreshes backup metadata without uploading or restoring while automatic backup is paused", async () => {
  mock.fetch.mockImplementation(async () => Response.json({ files }));
  await syncDrive(true);
  expect(mock.list).not.toHaveBeenCalled();
  expect(mock.save).not.toHaveBeenCalled();
  expect(mock.fetch.mock.calls.every(([, init]) => !init.method)).toBe(true);
  expect(useDriveBackup.getState().files[0]).toMatchObject({
    size: pdf.length,
    modifiedTime: files[0].modifiedTime,
  });
  expect(mock.settings.has(`driveLastBackup:${user.id}`)).toBe(false);
});
