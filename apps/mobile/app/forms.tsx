import { useState } from "react";
import { ScrollView, View, Switch } from "react-native";
import { router } from "expo-router";
import { Asset } from "expo-asset";
import { NotoSansDevanagari_400Regular } from "@expo-google-fonts/noto-sans-devanagari/400Regular";
import { inspectForm, fillForm, type FormField } from "@folio/pdf";
import { selectPdfs } from "../features/pdf";
import { readBytes, savePdf } from "../database";
import { Screen } from "../components/Screen";
import { Button, Card, Field, Label, layout } from "../components/ui";
import { PageHeading, Chip, Notice } from "../components/experience";
export default function Forms() {
  const [file, setFile] = useState<{ uri: string; name: string } | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [values, setValues] = useState<
    Record<string, string | boolean | string[]>
  >({});
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return (
    <Screen>
      <ScrollView
        contentContainerStyle={layout.content}
        keyboardShouldPersistTaps="handled"
      >
        <PageHeading
          title="Fill PDF forms"
          subtitle="Text fields, checkboxes and choices. Saved as a new PDF on your device."
        />
        <Button
          title={file ? "Choose another PDF" : "Choose a PDF form"}
          icon="document-text-outline"
          disabled={busy}
          onPress={async () => {
            const selected = (await selectPdfs())[0];
            if (!selected) return;
            setBusy(true);
            try {
              const result = await inspectForm(await readBytes(selected.uri));
              setFile(selected);
              setFields(result);
              setValues({});
              setLoaded(true);
            } finally {
              setBusy(false);
            }
          }}
        />
        {file && <Label size={18}>{file.name}</Label>}
        {loaded && !fields.length && (
          <Notice message="This PDF has no interactive form fields. A scanned form is an image; automatic field detection and form creation are not available here." />
        )}
        {fields.map((field) => (
          <Card key={field.name}>
            <Label size={18}>{field.name}</Label>
            {field.readOnly || field.kind === "unsupported" ? (
              <Label muted>
                {field.readOnly
                  ? "Read-only field"
                  : "Unsupported field (such as a digital signature or button)"}
              </Label>
            ) : (
              <View pointerEvents={busy ? "none" : "auto"}>
                {field.kind === "text" ? (
                  <Field
                    placeholder={
                      field.maxLength
                        ? `Text · maximum ${field.maxLength} characters`
                        : "Field text"
                    }
                    value={String(values[field.name] ?? field.value)}
                    onChangeText={(value) =>
                      setValues((previous) => ({
                        ...previous,
                        [field.name]: value,
                      }))
                    }
                    multiline
                  />
                ) : field.kind === "checkbox" ? (
                  <Switch
                    accessibilityLabel={field.name}
                    value={Boolean(values[field.name] ?? field.value)}
                    onValueChange={(value) =>
                      setValues((previous) => ({
                        ...previous,
                        [field.name]: value,
                      }))
                    }
                  />
                ) : (
                  <View style={layout.wrap}>
                    {(field.options ?? []).map((option) => {
                      const chosen = (values[field.name] ??
                        field.value) as string[];
                      return (
                        <Chip
                          key={option}
                          title={option}
                          selected={chosen.includes(option)}
                          onPress={() =>
                            setValues((previous) => ({
                              ...previous,
                              [field.name]: field.multiple
                                ? chosen.includes(option)
                                  ? chosen.filter((v) => v !== option)
                                  : [...chosen, option]
                                : chosen.includes(option)
                                  ? []
                                  : [option],
                            }))
                          }
                        />
                      );
                    })}
                  </View>
                )}
              </View>
            )}
          </Card>
        ))}
        {!!fields.length && (
          <>
            <Notice message="This fills existing interactive fields and keeps them editable. Review the saved PDF before sharing. Changes can invalidate existing digital signatures." />
            <Button
              title="Save filled PDF"
              icon="checkmark-outline"
              disabled={busy || !Object.keys(values).length}
              onPress={async () => {
                if (!file) return;
                setBusy(true);
                try {
                  const asset = Asset.fromModule(NotoSansDevanagari_400Regular);
                  await asset.downloadAsync();
                  if (!asset.localUri)
                    throw new Error("Form font is unavailable.");
                  const bytes = await fillForm(
                    await readBytes(file.uri),
                    values,
                    await readBytes(asset.localUri),
                  );
                  const doc = await savePdf(
                    `${file.name.replace(/\.pdf$/i, "")} filled`,
                    bytes,
                  );
                  router.replace({
                    pathname: "/document/[id]",
                    params: { id: doc.id },
                  });
                } finally {
                  setBusy(false);
                }
              }}
            />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
