import { create } from "zustand";
import type { ScanPage } from "@folio/shared-types";
interface Draft {
  pages: ScanPage[];
  idMode: boolean;
  add: (pages: ScanPage[]) => void;
  set: (pages: ScanPage[]) => void;
  clear: () => void;
  setIdMode: (value: boolean) => void;
}
export const useDraft = create<Draft>((set) => ({
  pages: [],
  idMode: false,
  add: (pages) => set((state) => ({ pages: [...state.pages, ...pages] })),
  set: (pages) => set({ pages }),
  clear: () => set({ pages: [], idMode: false }),
  setIdMode: (idMode) => set({ idMode }),
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
