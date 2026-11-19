import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  PanResponder,
  Text,
  View,
} from "react-native";
import { PDFDocument } from "pdf-lib";
import { editPdf, type PdfEdit } from "@folio/pdf";
import { readBytes, savePdf } from "../database";
import { usePdfPage } from "../hooks/usePdfPage";
import {
  movePlacement,
  pdfPlacement,
  type Placement,
} from "../features/signature/placement";
import { useTheme } from "../theme";
import { Button, Card, Field, Label, layout } from "./ui";

type Mark = { id: number; rect: Placement };
const stampWidth = 0.42;
const stampHeight = 0.085;

function DraggableStamp({
  rect,
  width,
  height,
  text,
  opacity,
  onMove,
  onDrag,
}: {
  rect: Placement;
  width: number;
  height: number;
  text: string;
  opacity: number;
  onMove: (rect: Placement) => void;
  onDrag: (active: boolean) => void;
}) {
  const latest = useRef({ rect, width, height, onMove, onDrag });
  latest.current = { rect, width, height, onMove, onDrag };
  const start = useRef(rect);
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          start.current = latest.current.rect;
          latest.current.onDrag(true);
        },
        onPanResponderMove: (_, gesture) => {
          const current = latest.current;
          current.onMove(
            movePlacement(
              start.current,
              gesture.dx / current.width,
              gesture.dy / current.height,
            ),
          );
        },
        onPanResponderRelease: () => latest.current.onDrag(false),
        onPanResponderTerminate: () => latest.current.onDrag(false),
      }),
    [],
  );
  return (
    <View
      {...pan.panHandlers}
      accessibilityLabel="Drag watermark"
      style={{
        position: "absolute",
        left: rect.left * width,
        top: rect.top * height,
        width: rect.width * width,
        height: rect.height * height,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: "#1761d5",
        justifyContent: "flex-end",
      }}
    >
      <Text
        pointerEvents="none"
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{
          color: "#143d7a",
          opacity,
          fontSize: rect.height * height * 0.72,
          includeFontPadding: false,
        }}
      >
        {text}
      </Text>
    </View>
  );
}

export function WatermarkEditor({
  file,
  onSaved,
  onDrag,
}: {
  file: { name: string; uri: string };
  onSaved: (id: string) => void;
  onDrag: (active: boolean) => void;
}) {
  const t = useTheme();
  const [text, setText] = useState("CONFIDENTIAL");
  const [opacity, setOpacity] = useState(0.35);
  const [everyPage, setEveryPage] = useState(true);
  const [page, setPage] = useState(0);
  const [count, setCount] = useState<number | null>(null);
  const [available, setAvailable] = useState(1);
  const nextId = useRef(1);
  const [marks, setMarks] = useState<Mark[]>([
    {
      id: 0,
      rect: { left: 0.29, top: 0.45, width: stampWidth, height: stampHeight },
    },
  ]);
  const { image, error, retry } = usePdfPage(file.uri, page);
  const ratio = image ? image.height / image.width : 1.4;
  const width = Math.min(available, 400 / ratio);
  const height = width * ratio;
  async function navigate() {
    const total =
      count ??
      (await PDFDocument.load(await readBytes(file.uri))).getPageCount();
    setCount(total);
    if (page + 1 < total) setPage(page + 1);
  }
  async function save() {
    const bytes = await readBytes(file.uri);
    const source = await PDFDocument.load(bytes);
    const stamps: NonNullable<PdfEdit["watermarks"]> = [];
    for (const index of everyPage ? source.getPageIndices() : [page]) {
      const target = source.getPage(index);
      for (const mark of marks) {
        const position = pdfPlacement(
          mark.rect,
          target.getCropBox(),
          target.getRotation().angle,
        );
        stamps.push({
          page: index,
          text,
          ...position,
          size: position.height * 0.72,
          opacity,
        });
      }
    }
    const copy = await savePdf(
      file.name.replace(/\.pdf$/i, "") + " watermarked",
      await editPdf(bytes, { watermarks: stamps }),
    );
    onSaved(copy.id);
  }
  return (
    <Card>
      <Label size={20}>Place watermark</Label>
      <Field value={text} onChangeText={setText} placeholder="Watermark text" />
      <View onLayout={(event) => setAvailable(event.nativeEvent.layout.width)}>
        {image ? (
          <View
            style={{
              width,
              height,
              alignSelf: "center",
              backgroundColor: "white",
            }}
          >
            <Image
              pointerEvents="none"
              source={{ uri: image.uri }}
              style={{ width, height }}
              resizeMode="stretch"
            />
            {marks.map((mark) => (
              <DraggableStamp
                key={mark.id}
                rect={mark.rect}
                width={width}
                height={height}
                text={text}
                opacity={opacity}
                onDrag={onDrag}
                onMove={(rect) =>
                  setMarks((current) =>
                    current.map((item) =>
                      item.id === mark.id ? { ...item, rect } : item,
                    ),
                  )
                }
              />
            ))}
          </View>
        ) : error ? (
          <>
            <Label>{error}</Label>
            <Button title="Retry preview" secondary onPress={retry} />
          </>
        ) : (
          <ActivityIndicator color={t.primary} />
        )}
      </View>
      <Label muted size={12}>
        Drag each stamp. The same layout is used on every page when All pages is
        selected.
      </Label>
      <View style={layout.wrap}>
        <Button
          compact
          secondary
          title="Previous"
          disabled={!page}
          onPress={() => setPage(page - 1)}
        />
        <Button
          compact
          secondary
          title="Next"
          disabled={count !== null && page + 1 >= count}
          onPress={navigate}
        />
        <Label size={13}>
          Page {page + 1}
          {count ? ` / ${count}` : ""}
        </Label>
      </View>
      <View style={layout.wrap}>
        <Button
          compact
          secondary
          title="Add another"
          icon="add-outline"
          disabled={marks.length >= 12}
          onPress={() => {
            const id = nextId.current++;
            setMarks((current) => [
              ...current,
              {
                id,
                rect: {
                  left: 0.12 + (id % 3) * 0.16,
                  top: 0.12 + (id % 7) * 0.1,
                  width: stampWidth,
                  height: stampHeight,
                },
              },
            ]);
          }}
        />
        <Button
          compact
          secondary
          title="Remove last"
          icon="remove-outline"
          disabled={marks.length <= 1}
          onPress={() => setMarks((current) => current.slice(0, -1))}
        />
        <Button
          compact
          secondary
          title={`Opacity ${Math.round(opacity * 100)}%`}
          onPress={() =>
            setOpacity(opacity === 0.65 ? 0.2 : opacity === 0.35 ? 0.65 : 0.35)
          }
        />
        <Button
          compact
          secondary
          title={everyPage ? "All pages" : "This page"}
          onPress={() => setEveryPage(!everyPage)}
        />
      </View>
      <Button
        title="Save watermarked copy"
        icon="checkmark-outline"
        disabled={!image || !text.trim()}
        onPress={save}
      />
    </Card>
  );
}
