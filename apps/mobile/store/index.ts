import { create } from "zustand";
import type { ScanPage } from "@folio/shared-types";
type DraftSnapshot = { pages: ScanPage[]; idMode: boolean };
interface Draft extends DraftSnapshot {
  past: DraftSnapshot[];
  future: DraftSnapshot[];
  add: (pages: ScanPage[]) => void;
  set: (pages: ScanPage[]) => void;
  clear: () => void;
  setIdMode: (value: boolean) => void;
  undo: () => void;
  redo: () => void;
}
const snapshot = (state: Draft): DraftSnapshot => ({
  pages: state.pages,
  idMode: state.idMode,
});
const remember = (state: Draft) =>
  state.pages.length ? [...state.past, snapshot(state)].slice(-20) : state.past;
export const useDraft = create<Draft>((set) => ({
  pages: [],
  idMode: false,
  past: [],
  future: [],
  add: (pages) =>
    set((state) =>
      pages.length
        ? {
            pages: [...state.pages, ...pages],
            past: remember(state),
            future: [],
          }
        : state,
    ),
  set: (pages) =>
    set((state) => ({ pages, past: remember(state), future: [] })),
  clear: () => set({ pages: [], idMode: false, past: [], future: [] }),
  setIdMode: (idMode) => set({ idMode }),
  undo: () =>
    set((state) => {
      const previous = state.past.at(-1);
      return previous
        ? {
            ...previous,
            past: state.past.slice(0, -1),
            future: [snapshot(state), ...state.future],
          }
        : state;
    }),
  redo: () =>
    set((state) => {
      const next = state.future[0];
      return next
        ? {
            ...next,
            past: [...state.past, snapshot(state)].slice(-20),
            future: state.future.slice(1),
          }
        : state;
    }),
}));
export const useSettings = create<{
  theme: "system" | "light" | "dark";
  quality: number;
  backup: boolean;
  lock: boolean;
  ready: boolean;
  refresh: () => Promise<void>;
  change: (
    key: "theme" | "quality" | "backup" | "lock",
    value: unknown,
  ) => Promise<void>;
}>((set) => ({
  theme: "system",
  quality: 90,
  backup: false,
  lock: false,
  ready: false,
  refresh: async () => {
    const { setting } = await import("../database");
    set({
      theme: await setting("theme", "system"),
      quality: await setting("quality", 90),
      backup: await setting("backup", false),
      lock: await setting("lock", false),
      ready: true,
    });
  },
  change: async (key, value) => {
    const { setSetting } = await import("../database");
    await setSetting(key, value);
    set({ [key]: value });
  },
}));
