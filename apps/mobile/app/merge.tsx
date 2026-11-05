import { useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { router } from "expo-router";
import * as Crypto from "expo-crypto";
import { mergePdfs } from "@folio/pdf";
import { Screen } from "../components/Screen";
import { Button, Card, Field, Label, layout } from "../components/ui";
import { PageHeading, IconBadge, Notice } from "../components/experience";
import { selectPdfs } from "../features/pdf";
import { readBytes, savePdf } from "../database";
import { useTheme } from "../theme";
type Selected = { id: string; uri: string; name: string; size?: number };
export default function MergeScreen() {
  const t = useTheme();
  const [files, setFiles] = useState<Selected[]>([]);
  const [title, setTitle] = useState("Merged document");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const pending = useRef(false);
  const move = (index: number, direction: number) =>
    setFiles((previous) => {
      const next = [...previous];
      const target = index + direction;
      if (target < 0 || target >= next.length) return previous;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  return (
    <Screen>
      <ScrollView
        contentContainerStyle={layout.content}
        keyboardShouldPersistTaps="handled"
      >
        <PageHeading
          title="One PDF. Your order."
          subtitle="Add files, arrange them, then save a combined copy."
        />
        <Field
          value={title}
          onChangeText={setTitle}
          placeholder="New document name"
        />
        <Button
          title={files.length ? "Add more PDFs" : "Choose PDFs"}
          icon="add-circle-outline"
          secondary={!!files.length}
          disabled={busy || files.length >= 20}
          onPress={async () => {
            const chosen = await selectPdfs(true);
            if (files.length + chosen.length > 20)
              throw new Error("Merge up to 20 files at a time.");
            if (
              [...files, ...chosen].reduce(
                (sum, file) => sum + (file.size ?? 0),
                0,
              ) >
              60 * 1048576
            )
              throw new Error("Keep the combined input size below 60 MB.");
            setFiles((previous) => [
              ...previous,
              ...chosen.map((file) => ({ ...file, id: Crypto.randomUUID() })),
            ]);
          }}
        />
        {!files.length && (
          <Card>
            <IconBadge icon="layers-outline" large />
            <Label size={20}>Bring your files together</Label>
            <Label muted>
              Add two or more PDFs. Their pages will follow the file order
              below.
            </Label>
          </Card>
        )}
        {files.map((file, index) => (
          <Card key={file.id} style={{ padding: 14 }}>
            <View style={layout.row}>
              <IconBadge icon="document-text-outline" />
              <View style={{ flex: 1, gap: 3 }}>
                <Label numberOfLines={2}>
                  {index + 1}. {file.name}
                </Label>
                <Label muted size={12}>
                  {file.size
                    ? `${(file.size / 1048576).toFixed(1)} MB`
                    : "PDF document"}
                </Label>
              </View>
            </View>
            <View style={layout.row}>
              <Button
                title="Earlier"
                compact
                secondary
                icon="arrow-up-outline"
                disabled={busy || index === 0}
                onPress={() => move(index, -1)}
              />
              <Button
                title="Later"
                compact
                secondary
                icon="arrow-down-outline"
                disabled={busy || index === files.length - 1}
                onPress={() => move(index, 1)}
              />
              <Button
                title="Remove"
                compact
                secondary
                icon="close-outline"
                disabled={busy}
                onPress={() =>
                  setFiles((previous) =>
                    previous.filter((f) => f.id !== file.id),
                  )
                }
              />
            </View>
          </Card>
        ))}
        <Notice message="Original PDFs stay unchanged. Password-protected files must be unlocked before merging." />
      </ScrollView>
      <View
        style={{
          padding: 16,
          gap: 8,
          backgroundColor: t.surface,
          borderTopWidth: 1,
          borderColor: t.line,
        }}
      >
        {!!progress && (
          <Label muted size={12}>
            {progress}
          </Label>
        )}
        <Button
          title={`Merge ${files.length} PDFs`}
          icon="layers-outline"
          disabled={busy || files.length < 2 || !title.trim()}
          onPress={async () => {
            if (pending.current) return;
            pending.current = true;
            setBusy(true);
            try {
              const input: Uint8Array[] = [];
              let total = 0;
              for (const [i, file] of files.entries()) {
                setProgress(`Reading file ${i + 1} of ${files.length}…`);
                const bytes = await readBytes(file.uri);
                total += bytes.length;
                if (total > 60 * 1048576)
                  throw new Error("Keep the combined input size below 60 MB.");
                input.push(bytes);
              }
              setProgress("Combining pages and saving…");
              const doc = await savePdf(title, await mergePdfs(input));
              router.replace({
                pathname: "/document/[id]",
                params: { id: doc.id },
              });
            } finally {
              pending.current = false;
              setBusy(false);
              setProgress("");
            }
          }}
        />
      </View>
    </Screen>
  );
}
