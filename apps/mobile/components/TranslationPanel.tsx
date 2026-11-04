import { useEffect, useState } from "react";
import { View } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as FS from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Asset } from "expo-asset";
import { NotoSansDevanagari_400Regular } from "@expo-google-fonts/noto-sans-devanagari/400Regular";
import { router } from "expo-router";
import { textToPdf } from "@folio/pdf";
import { translateText, type Language } from "../features/translation";
import { readBytes, savePdf, setting, setSetting } from "../database";
import { Button, Field, Label, layout } from "./ui";
import { Chip, Notice } from "./experience";
export function TranslationPanel({
  text,
  id,
  title,
  sensitive,
  onRecognize,
}: {
  text: string;
  id: string;
  title: string;
  sensitive: boolean;
  onRecognize?: (language: Language) => Promise<string>;
}) {
  const [source, setSource] = useState<Language>("en"),
    [target, setTarget] = useState<Language>("hi"),
    [input, setInput] = useState(text),
    [output, setOutput] = useState(""),
    [progress, setProgress] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setInput(text);
    setOutput("");
    void setting<{
      input: string;
      output: string;
      source: Language;
      target: Language;
    } | null>(`translation:${id}`, null)
      .then((saved) => {
        if (active && saved && saved.input === text) {
          setOutput(saved.output);
          setSource(saved.source);
          setTarget(saved.target);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [id, text]);
  return (
    <View style={{ gap: 14 }}>
      <Notice message="First use downloads a language model over Wi-Fi (about 30 MB). Translation then runs on your device. Review machine translations before sharing." />
      <View pointerEvents={busy ? "none" : "auto"} style={{ gap: 12 }}>
        <Label muted size={12}>
          TRANSLATE FROM
        </Label>
        <View style={layout.row}>
          {(["en", "hi"] as Language[]).map((lang) => (
            <Chip
              key={lang}
              title={lang === "en" ? "English" : "Hindi"}
              selected={source === lang}
              onPress={() => {
                setSource(lang);
                setTarget(lang === "en" ? "hi" : "en");
                setOutput("");
                setProgress("");
              }}
            />
          ))}
        </View>
        <Label muted>To {target === "hi" ? "Hindi" : "English"}</Label>
        <Field
          multiline
          value={input}
          onChangeText={(value) => {
            setInput(value);
            setOutput("");
            setProgress("");
          }}
          placeholder="Recognize text above or paste text here"
        />
      </View>
      <Button
        title={
          !input.trim() && onRecognize
            ? "Recognize & translate document"
            : "Translate document text"
        }
        icon="language-outline"
        disabled={(!input.trim() && !onRecognize) || busy}
        onPress={async () => {
          setBusy(true);
          setOutput("");
          try {
            let sourceText = input;
            if (!sourceText.trim() && onRecognize) {
              setProgress("Recognizing document text…");
              sourceText = await onRecognize(source);
              setInput(sourceText);
            }
            const result = await translateText(
              sourceText,
              source,
              target,
              setProgress,
            );
            setOutput(result);
            await setSetting(`translation:${id}`, {
              input: sourceText,
              output: result,
              source,
              target,
            });
          } catch (e) {
            setProgress("");
            throw e;
          } finally {
            setBusy(false);
          }
        }}
      />
      {!!progress && (
        <Label muted size={12}>
          {progress}
        </Label>
      )}
      {!!output && (
        <>
          <Field
            value={output}
            onChangeText={setOutput}
            multiline
            placeholder="Translated text"
          />
          <View style={layout.wrap}>
            <Button
              title="Copy translation"
              secondary
              onPress={() => Clipboard.setStringAsync(output)}
            />
            <Button
              title="Export TXT"
              secondary
              onPress={async () => {
                const uri = `${FS.cacheDirectory}translation-${id}.txt`;
                await FS.writeAsStringAsync(uri, output);
                await Sharing.shareAsync(uri, { mimeType: "text/plain" });
              }}
            />
            <Button
              title="Save translated PDF"
              onPress={async () => {
                const font = Asset.fromModule(NotoSansDevanagari_400Regular);
                await font.downloadAsync();
                if (!font.localUri) throw new Error("Font unavailable.");
                const doc = await savePdf(
                  `${title} ${target} translation`,
                  await textToPdf(output, await readBytes(font.localUri)),
                  [],
                  sensitive,
                );
                router.push({
                  pathname: "/document/[id]",
                  params: { id: doc.id },
                });
              }}
            />
          </View>
          <Label muted size={12}>
            PDF export uses a new text layout. The original page design and
            images are not retained.
          </Label>
        </>
      )}
    </View>
  );
}
