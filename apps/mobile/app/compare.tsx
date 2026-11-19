import { useState } from "react";
import { ScrollView, View, useWindowDimensions } from "react-native";
import { Screen } from "../components/Screen";
import { Button, Label, layout } from "../components/ui";
import { PageHeading, Notice } from "../components/experience";
import { selectPdfs } from "../features/pdf";
import { loadPdfPreview } from "../native/optionalPdf";

const PdfPreview = loadPdfPreview();
export default function Compare() {
  const [files, setFiles] = useState<({ uri: string; name: string } | null)[]>([
    null,
    null,
  ]);
  const [counts, setCounts] = useState([0, 0]);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const { width } = useWindowDimensions();
  const sideBySide = width >= 600;
  return (
    <Screen>
      <ScrollView contentContainerStyle={layout.content}>
        <PageHeading
          title="Compare two PDFs"
          subtitle="Review the same page in both versions. Rotate your phone for side-by-side viewing."
        />
        <Notice message="Visual comparison only: changes are not automatically highlighted. Pinch each preview to inspect details." />
        <View style={{ flexDirection: sideBySide ? "row" : "column", gap: 12 }}>
          {files.map((file, index) => (
            <View key={index} style={{ flex: 1, gap: 10 }}>
              <Button
                title={index ? "Choose revised PDF" : "Choose original PDF"}
                secondary
                icon="document-outline"
                onPress={async () => {
                  const selected = (await selectPdfs())[0];
                  if (selected) {
                    setFiles((previous) =>
                      previous.map((v, i) => (i === index ? selected : v)),
                    );
                    setCounts((previous) =>
                      previous.map((v, i) => (i === index ? 0 : v)),
                    );
                    setPage(1);
                    setError("");
                  }
                }}
              />
              {file && (
                <>
                  <Label numberOfLines={2}>{file.name}</Label>
                  {PdfPreview ? (
                    <PdfPreview
                      key={file.uri}
                      source={{ uri: file.uri, cache: false }}
                      page={Math.min(page, counts[index] || 1)}
                      style={{ width: "100%", height: sideBySide ? 420 : 300 }}
                      trustAllCerts={false}
                      enablePaging
                      scrollEnabled={false}
                      onLoadComplete={(count) =>
                        setCounts((previous) =>
                          previous.map((v, i) => (i === index ? count : v)),
                        )
                      }
                      onError={(e) => setError(String(e))}
                    />
                  ) : (
                    <Notice
                      error
                      message="PDF preview needs the Folio development build."
                    />
                  )}
                  {counts[index] > 0 && (
                    <Label muted size={12}>
                      {page <= counts[index]
                        ? `Page ${page} of ${counts[index]}`
                        : `No page ${page} in this file · showing last page`}
                    </Label>
                  )}
                </>
              )}
            </View>
          ))}
        </View>
        {!!error && <Notice error message={error} />}
        {files.every(Boolean) && (
          <View style={layout.row}>
            <Button
              title="Previous"
              secondary
              icon="chevron-back"
              disabled={page <= 1}
              onPress={() => setPage(page - 1)}
            />
            <Label>{page}</Label>
            <Button
              title="Next"
              secondary
              icon="chevron-forward"
              disabled={page >= Math.max(...counts)}
              onPress={() => setPage(page + 1)}
            />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
