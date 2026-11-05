import { beforeEach, expect, it } from "vitest";
import { useDraft } from "../apps/mobile/store";
import type { ScanPage } from "@folio/shared-types";
const page: ScanPage = {
  id: "1",
  uri: "original.jpg",
  originalUri: "original.jpg",
  width: 600,
  height: 800,
  rotation: 0,
  filter: "original",
};
beforeEach(() => useDraft.getState().clear());
it("undoes and redoes image edits without losing the unfiltered source", () => {
  useDraft.getState().add([page]);
  useDraft
    .getState()
    .set([
      { ...page, uri: "clean.jpg", filter: "clean", editBaseUri: page.uri },
    ]);
  useDraft.getState().undo();
  expect(useDraft.getState().pages).toEqual([page]);
  useDraft.getState().redo();
  expect(useDraft.getState().pages[0]).toMatchObject({
    filter: "clean",
    editBaseUri: page.uri,
  });
});
it("restores a removed last page and clears redo when a new edit is made", () => {
  useDraft.getState().add([page]);
  useDraft.getState().set([]);
  useDraft.getState().undo();
  expect(useDraft.getState().pages).toHaveLength(1);
  useDraft.getState().set([{ ...page, rotation: 90 }]);
  expect(useDraft.getState().future).toHaveLength(0);
});
it("caps history and forgets all document references after discard/save", () => {
  useDraft.getState().add([page]);
  for (let i = 0; i < 30; i++)
    useDraft.getState().set([{ ...page, uri: `${i}.jpg` }]);
  expect(useDraft.getState().past).toHaveLength(20);
  useDraft.getState().clear();
  expect(useDraft.getState()).toMatchObject({
    pages: [],
    past: [],
    future: [],
    idMode: false,
  });
});
it("records a multi-page edit as one undo operation", () => {
  const second = { ...page, id: "2" };
  useDraft.getState().add([page, second]);
  useDraft.getState().set([page, second].map((p) => ({ ...p, filter: "bw" })));
  useDraft.getState().undo();
  expect(useDraft.getState().pages.map((p) => p.filter)).toEqual([
    "original",
    "original",
  ]);
});
