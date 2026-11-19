import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  pages: [] as unknown[],
  idMode: false,
  navigate: vi.fn(),
  push: vi.fn(),
  alert: vi.fn(),
}));
vi.mock("react-native", () => ({ Alert: { alert: state.alert } }));
vi.mock("expo-router", () => ({
  router: { navigate: state.navigate, push: state.push },
}));
vi.mock("../apps/mobile/store", () => ({
  useDraft: { getState: () => ({ pages: state.pages, idMode: state.idMode }) },
}));
import { launchScanner } from "../apps/mobile/features/scanner/launch";

beforeEach(() => {
  vi.resetAllMocks();
  state.pages = [];
  state.idMode = false;
});

it("opens the scan session before starting the external scanner", async () => {
  await launchScanner();
  expect(state.navigate).toHaveBeenCalledWith({
    pathname: "/scan-session",
    params: { mode: "document" },
  });
  expect(state.push).not.toHaveBeenCalled();
});

it("opens review for existing pages without launching another scanner", async () => {
  state.pages = [{ id: "old" }];
  state.alert.mockImplementation((_title, _message, buttons) =>
    buttons[1].onPress(),
  );
  await launchScanner();
  expect(state.navigate).not.toHaveBeenCalled();
  expect(state.push).toHaveBeenCalledWith("/editor");
});

it("preserves ID mode when adding scans and ignores duplicate taps during the prompt", async () => {
  state.pages = [{ id: "old" }];
  state.idMode = true;
  const launch = launchScanner();
  await launchScanner();
  expect(state.alert).toHaveBeenCalledTimes(1);
  state.alert.mock.calls[0][2][2].onPress();
  await launch;
  expect(state.navigate).toHaveBeenCalledWith({
    pathname: "/scan-session",
    params: { mode: "id" },
  });
});

it("stays on the current screen when the draft prompt is cancelled", async () => {
  state.pages = [{ id: "old" }];
  state.alert.mockImplementation((_title, _message, buttons) =>
    buttons[0].onPress(),
  );
  await launchScanner();
  expect(state.navigate).not.toHaveBeenCalled();
  expect(state.push).not.toHaveBeenCalled();
});
