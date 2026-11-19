import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { PDFDocument } from "pdf-lib";
import { readBytes } from "../database";
import { PdfReader } from "./PdfReader";
import { Button, Label } from "./ui";

/** Show the actual selected source alongside editing controls. */
export function PdfFilePreview({ uri }: { uri: string }) {
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setCount(0);
    setPage(1);
    setError("");
    void readBytes(uri)
      .then((bytes) => PDFDocument.load(bytes))
      .then((pdf) => {
        if (active) setCount(pdf.getPageCount());
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : "Cannot open this PDF.");
      });
    return () => {
      active = false;
    };
  }, [uri, attempt]);
  return (
    <View style={{ gap: 12 }}>
      <Label muted size={12}>
        Source PDF · edits are applied when you save a copy
      </Label>
      {error ? (
        <>
          <Label>{error}</Label>
          <Button
            title="Retry preview"
            secondary
            onPress={() => setAttempt((v) => v + 1)}
          />
        </>
      ) : count ? (
        <PdfReader uri={uri} count={count} page={page} onPage={setPage} />
      ) : (
        <ActivityIndicator accessibilityLabel="Opening PDF preview" />
      )}
    </View>
  );
}
