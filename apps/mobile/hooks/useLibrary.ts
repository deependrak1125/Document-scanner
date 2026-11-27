import { useDriveBackup } from "../features/drive";
import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import type { LocalDocument } from "@folio/shared-types";
import { listDocuments } from "../database";
export function useLibrary(
  query = "",
  trash = false,
  sort: "date" | "name" | "size" = "date",
) {
  const [documents, setDocuments] = useState<LocalDocument[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const generation = useRef(0);
  const driveRevision = useDriveBackup((state) => state.libraryRevision);
  const reload = useCallback(async () => {
    const version = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const result = await listDocuments(query, trash, sort);
      if (version === generation.current) setDocuments(result);
    } catch (e) {
      if (version === generation.current)
        setError(
          e instanceof Error ? e.message : "Couldn't load your documents.",
        );
    } finally {
      if (version === generation.current) setLoading(false);
    }
  }, [query, trash, sort]);
  useFocusEffect(
    useCallback(() => {
      void reload();
      return () => {
        generation.current++;
      };
    }, [reload, driveRevision]),
  );
  return { documents, loading, error, reload };
}
