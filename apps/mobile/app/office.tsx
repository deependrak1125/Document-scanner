import { useState } from "react";
import { ScrollView } from "react-native";
import { router } from "expo-router";
import * as Picker from "expo-document-picker";
import { File } from "expo-file-system";
import { fetch as expoFetch } from "expo/fetch";
import { Screen } from "../components/Screen";
import { Button, Label, layout } from "../components/ui";
import { PageHeading, Notice } from "../components/experience";
import { api, authorized, useAuth } from "../features/auth";
import { savePdf } from "../database";
export default function Office() {
  const user = useAuth((s) => s.user);
  const [file, setFile] = useState<{
    uri: string;
    name: string;
    extension: string;
  } | null>(null);
  const [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false);
  return (
    <Screen>
      <ScrollView contentContainerStyle={layout.content}>
        <PageHeading
          title="Office to PDF"
          subtitle="Convert Word documents, spreadsheets and slides into a PDF."
        />
        <Notice message="Supports DOCX, XLSX and PPTX. Conversion uploads the chosen file to your signed-in server. Review the result: fonts, charts and pagination may differ from Microsoft Office." />
        {!user && (
          <Button
            title="Sign in to convert"
            icon="person-outline"
            onPress={() => router.push("/login")}
          />
        )}
        <Button
          title={file ? "Change file" : "Choose an Office file"}
          secondary
          icon="document-attach-outline"
          disabled={busy}
          onPress={async () => {
            const result = await Picker.getDocumentAsync({
              type: [
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "application/vnd.openxmlformats-officedocument.presentationml.presentation",
              ],
              copyToCacheDirectory: true,
            });
            if (result.canceled) return;
            const selected = result.assets[0],
              extension = selected.name.split(".").pop()?.toLowerCase() ?? "";
            if (
              !["docx", "xlsx", "pptx"].includes(extension) ||
              (selected.size ?? 0) > 30 * 1048576
            )
              throw new Error("Choose a DOCX, XLSX or PPTX file under 30 MB.");
            setFile({ ...selected, extension });
            setConsent(false);
          }}
        />
        {file && <Label size={18}>{file.name}</Label>}
        <Button
          title={
            consent
              ? "Upload allowed · tap to revoke"
              : "Allow upload of this file for conversion"
          }
          icon={consent ? "checkmark-circle-outline" : "cloud-upload-outline"}
          secondary
          disabled={!file || busy}
          onPress={() => setConsent(!consent)}
        />
        <Button
          title={busy ? "Converting…" : "Convert & save PDF"}
          icon="document-text-outline"
          disabled={!file || !consent || !user || busy}
          onPress={async () => {
            if (!file) return;
            setBusy(true);
            try {
              await authorized(() => api.request("/auth/me"));
              const response = await expoFetch(
                `${api.baseUrl}/api/v1/office/convert`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${useAuth.getState().token}`,
                    "Content-Type": "application/octet-stream",
                    "X-Folio-Format": file.extension,
                    "X-Folio-Consent": "upload-for-processing",
                  },
                  body: new File(file.uri),
                },
              );
              if (!response.ok) {
                const data = (await response.json()) as {
                  error?: { message?: string };
                };
                throw new Error(data.error?.message ?? "Conversion failed.");
              }
              const doc = await savePdf(
                file.name.replace(/\.[^.]+$/, ""),
                new Uint8Array(await response.arrayBuffer()),
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
        <Label muted size={12}>
          The temporary uploaded file is deleted after processing. This
          conversion requires a server with Office conversion enabled.
        </Label>
      </ScrollView>
    </Screen>
  );
}
