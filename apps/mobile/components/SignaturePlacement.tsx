import { useEffect, useRef, useState } from "react";
import {
  View,
  Image,
  PanResponder,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePdfPage } from "../hooks/usePdfPage";
import {
  movePlacement,
  resizePlacement,
  type Placement,
} from "../features/signature/placement";
import { useTheme } from "../theme";
import { Button, Label, layout } from "./ui";

export function SignaturePlacement({
  uri,
  page,
  signature,
  onChange,
  onDrag,
  maxHeight = 520,
}: {
  uri: string;
  page: number;
  signature?: string | null;
  onChange: (p: Placement | null) => void;
  onDrag: (active: boolean) => void;
  maxHeight?: number;
}) {
  const t = useTheme();
  const { image, error, retry } = usePdfPage(uri, page);
  const [available, setAvailable] = useState(300);
  const [aspect, setAspect] = useState(2.5);
  const [rect, setRect] = useState<Placement>({
    left: 0.12,
    top: 0.65,
    width: 0.4,
    height: 0.12,
  });
  const pageRatio = image ? image.height / image.width : 1.414;
  const canvas = Math.min(available, Math.max(120, maxHeight) / pageRatio);
  const height = canvas * pageRatio;
  const callbacks = useRef({ onChange, onDrag });
  callbacks.current = { onChange, onDrag };
  const latest = useRef({ rect, canvas, height, aspect });
  latest.current = { rect, canvas, height, aspect };
  const start = useRef(rect);
  function commit(value: Placement) {
    latest.current.rect = value;
    setRect(value);
    callbacks.current.onChange(value);
  }
  useEffect(() => {
    let live = true;
    if (signature)
      Image.getSize(
        signature,
        (w, h) => {
          if (live && w > 0 && h > 0) setAspect(w / h);
        },
        () => {},
      );
    return () => {
      live = false;
    };
  }, [signature]);
  useEffect(() => {
    if (!image || !signature) {
      callbacks.current.onChange(null);
      return;
    }
    const ratio = image.width / image.height / aspect;
    const width = Math.min(0.4, 0.3 / ratio);
    commit({ left: 0.12, top: 0.65, width, height: width * ratio });
  }, [image, signature, aspect]);
  useEffect(() => () => callbacks.current.onDrag(false), []);
  // Stable responders keep ownership throughout a drag, including parent updates.
  const responders = useRef(
    [false, true].map((resize) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => resize,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          start.current = latest.current.rect;
          callbacks.current.onDrag(true);
        },
        onPanResponderMove: (_, gesture) => {
          const current = latest.current;
          commit(
            resize
              ? resizePlacement(
                  start.current,
                  gesture.dx / current.canvas,
                  current.canvas / current.height / current.aspect,
                )
              : movePlacement(
                  start.current,
                  gesture.dx / current.canvas,
                  gesture.dy / current.height,
                ),
          );
        },
        onPanResponderRelease: () => callbacks.current.onDrag(false),
        onPanResponderTerminate: () => callbacks.current.onDrag(false),
      }),
    ),
  ).current;
  return (
    <View
      style={{ gap: 10 }}
      onLayout={(e) => setAvailable(e.nativeEvent.layout.width)}
    >
      {error ? (
        <View style={{ padding: 20, gap: 12 }}>
          <Label>{error}</Label>
          <Button title="Retry page preview" onPress={retry} />
        </View>
      ) : !image ? (
        <View
          style={{
            height: Math.min(maxHeight, 300),
            justifyContent: "center",
            gap: 12,
          }}
        >
          <ActivityIndicator color={t.primary} />
          <Label muted>Loading PDF page…</Label>
        </View>
      ) : (
        <Pressable
          accessibilityLabel="PDF page; tap to place signature"
          onPress={(e) => {
            if (!signature) return;
            const r = latest.current.rect;
            commit(
              movePlacement(
                r,
                e.nativeEvent.locationX / canvas - r.width / 2 - r.left,
                e.nativeEvent.locationY / height - r.height / 2 - r.top,
              ),
            );
          }}
          style={{
            alignSelf: "center",
            width: canvas,
            height,
            backgroundColor: "white",
            borderColor: t.line,
            borderWidth: 1,
          }}
        >
          <Image
            pointerEvents="none"
            source={{ uri: image.uri }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="stretch"
          />
          {!!signature && (
            <View
              {...responders[0].panHandlers}
              accessibilityLabel="Drag signature"
              style={{
                position: "absolute",
                left: rect.left * canvas,
                top: rect.top * height,
                width: rect.width * canvas,
                height: rect.height * height,
                borderWidth: 1.5,
                borderColor: t.primary,
                borderStyle: "dashed",
              }}
            >
              <Image
                pointerEvents="none"
                source={{ uri: signature }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="stretch"
              />
              <View
                {...responders[1].panHandlers}
                accessibilityLabel="Resize signature"
                style={{
                  position: "absolute",
                  right: -14,
                  bottom: -14,
                  width: 44,
                  height: 44,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <View
                  pointerEvents="none"
                  style={{
                    backgroundColor: t.primary,
                    padding: 5,
                    borderRadius: 20,
                  }}
                >
                  <Ionicons name="resize-outline" size={20} color="white" />
                </View>
              </View>
            </View>
          )}
        </Pressable>
      )}
      {!!signature && !!image && (
        <>
          <Label muted size={12}>
            Drag to move · blue handle to resize · tap the page to place
          </Label>
          <View style={layout.row}>
            <Button
              title="Smaller"
              icon="remove-outline"
              secondary
              onPress={() =>
                commit(resizePlacement(rect, -0.04, canvas / height / aspect))
              }
            />
            <Button
              title="Larger"
              icon="add-outline"
              secondary
              onPress={() =>
                commit(resizePlacement(rect, 0.04, canvas / height / aspect))
              }
            />
            <Button
              title="Center"
              icon="locate-outline"
              secondary
              onPress={() =>
                commit({
                  ...rect,
                  left: (1 - rect.width) / 2,
                  top: (1 - rect.height) / 2,
                })
              }
            />
          </View>
        </>
      )}
    </View>
  );
}
