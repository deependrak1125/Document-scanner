import { useState } from "react";
import {
  View,
  Image,
  Modal,
  ActivityIndicator,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePdfPage } from "../hooks/usePdfPage";
import { loadPdfPreview } from "../native/optionalPdf";
import { useTheme } from "../theme";
import { Button, Label, layout } from "./ui";

const NativePdf = loadPdfPreview();
function RasterPage({
  uri,
  page,
  height,
}: {
  uri: string;
  page: number;
  height: number;
}) {
  const { image, error, retry } = usePdfPage(uri, page - 1);
  const t = useTheme();
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(300);
  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ height, gap: 8 }}
    >
      {error ? (
        <View style={{ padding: 16, gap: 12 }}>
          <Label>{error}</Label>
          <Button title="Retry page preview" secondary onPress={retry} />
        </View>
      ) : !image ? (
        <View style={{ flex: 1, justifyContent: "center", gap: 12 }}>
          <ActivityIndicator color={t.primary} />
          <Label muted>Rendering page {page}…</Label>
        </View>
      ) : (
        <>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ alignItems: "center" }}
            nestedScrollEnabled
          >
            <ScrollView
              horizontal
              contentContainerStyle={{
                minWidth: width,
                justifyContent: "center",
              }}
              nestedScrollEnabled
            >
              <Image
                source={{ uri: image.uri }}
                style={{
                  width: width * zoom,
                  height: (width * zoom * image.height) / image.width,
                }}
                resizeMode="contain"
              />
            </ScrollView>
          </ScrollView>
          <View style={layout.row}>
            <Button
              title="Zoom out"
              icon="remove-outline"
              secondary
              disabled={zoom === 1}
              onPress={() => setZoom(Math.max(1, zoom - 0.5))}
            />
            <Label>{Math.round(zoom * 100)}%</Label>
            <Button
              title="Zoom in"
              icon="add-outline"
              secondary
              disabled={zoom >= 3}
              onPress={() => setZoom(Math.min(3, zoom + 0.5))}
            />
          </View>
        </>
      )}
    </View>
  );
}

export function PdfReader({
  uri,
  count,
  page,
  onPage,
}: {
  uri: string;
  count: number;
  page: number;
  onPage: (page: number) => void;
}) {
  const t = useTheme();
  const { height: screenHeight } = useWindowDimensions();
  const [full, setFull] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const raster = !NativePdf || failed === uri;
  const render = (height: number) =>
    raster || !NativePdf ? (
      <RasterPage
        key={`${uri}:${page}`}
        uri={uri}
        page={page}
        height={height}
      />
    ) : (
      <NativePdf
        source={{ uri, cache: false }}
        page={page}
        style={{ height, width: "100%", backgroundColor: t.tint }}
        trustAllCerts={false}
        enablePaging
        onPageChanged={onPage}
        onError={() => setFailed(uri)}
      />
    );
  const controls = (
    <View style={{ ...layout.row, justifyContent: "space-between" }}>
      <Button
        title="Previous"
        icon="chevron-back-outline"
        secondary
        disabled={page <= 1}
        onPress={() => onPage(page - 1)}
      />
      <Label size={13}>
        {page} / {count}
      </Label>
      <Button
        title="Next"
        icon="chevron-forward-outline"
        secondary
        disabled={page >= count}
        onPress={() => onPage(page + 1)}
      />
    </View>
  );
  return (
    <View style={{ gap: 12 }}>
      {!full && render(Math.min(420, screenHeight * 0.52))}
      {controls}
      <Button
        title="Full-screen preview"
        icon="expand-outline"
        secondary
        onPress={() => setFull(true)}
      />
      <Modal
        visible={full}
        onRequestClose={() => setFull(false)}
        animationType="slide"
      >
        <SafeAreaView
          style={{ flex: 1, backgroundColor: t.bg, padding: 16, gap: 12 }}
        >
          <Button
            title="Close preview"
            icon="close-outline"
            secondary
            onPress={() => setFull(false)}
          />
          <View style={{ flex: 1 }}>
            {full && render(Math.max(180, screenHeight - 230))}
          </View>
          {controls}
        </SafeAreaView>
      </Modal>
    </View>
  );
}
