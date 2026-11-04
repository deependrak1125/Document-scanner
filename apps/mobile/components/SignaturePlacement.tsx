import { useEffect, useRef, useState } from "react";
import { View, Image, PanResponder, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { rasterizePdf } from "../native/image";
import type { Placement } from "../features/signature/placement";
import { useTheme } from "../theme";
import { Button, Label } from "./ui";
export function SignaturePlacement({ uri, page, signature, onChange, onDrag }: { uri: string; page: number; signature: string; onChange: (p: Placement) => void; onDrag: (active: boolean) => void }) {
  const t = useTheme();
  const [preview, setPreview] = useState<{uri: string; width: number; height: number} | null>(null);
  const [error, setError] = useState("");
  const [canvas, setCanvas] = useState(280);
  const [aspect, setAspect] = useState(2.5);
  const [rect, setRect] = useState<Placement>({ left: .1, top: .65, width: .4, height: .12 });
  const latest = useRef(rect); latest.current = rect;
  const start = useRef(rect);
  const height = preview ? canvas * preview.height / preview.width : canvas;
  const commit = (p: Placement) => { latest.current = p; setRect(p); onChange(p); };
  useEffect(() => { Image.getSize(signature, (w,h) => setAspect(w/h), () => {}); }, [signature]);
  useEffect(() => {
    let live = true; setPreview(null); setError("");
    void rasterizePdf(uri, page).then(p => { if (live) { setPreview(p); const r = { left: .1, top: .65, width: .4, height: .4 * p.width / p.height / aspect }; latest.current = r; setRect(r); onChange(r); } }).catch(e => { if (live) setError(e instanceof Error ? e.message : "Cannot load page."); });
    return () => { live = false; onDrag(false); };
    // Callbacks do not change the page image.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri, page, aspect]);
  const responder = (resize: boolean) => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { start.current = latest.current; onDrag(true); },
    onPanResponderMove: (_, g) => {
      const s = start.current;
      if (resize) {
        const width = Math.max(.12, Math.min(1-s.left, (1-s.top)*height*aspect/canvas, s.width+g.dx/canvas));
        commit({ ...s, width, height: width*canvas/height/aspect });
      } else commit({ ...s, left: Math.max(0, Math.min(1-s.width, s.left+g.dx/canvas)), top: Math.max(0, Math.min(1-s.height, s.top+g.dy/height)) });
    },
    onPanResponderRelease: () => onDrag(false),
    onPanResponderTerminate: () => onDrag(false),
  });
  return <View style={{ gap: 12 }} onLayout={e => setCanvas(e.nativeEvent.layout.width)}>
    <Label muted size={12}>Drag your signature to position it. Drag the bottom-right handle to resize.</Label>
    {error ? <Label>{error}</Label> : !preview ? <ActivityIndicator color={t.primary} /> : <View style={{ width: canvas, height, backgroundColor: "white", borderRadius: 8, overflow: "hidden" }}>
      <Image source={{ uri: preview.uri }} style={{ width: canvas, height }} />
      <View {...responder(false).panHandlers} accessibilityLabel="Drag signature" style={{ position: "absolute", left: rect.left*canvas, top: rect.top*height, width: rect.width*canvas, height: rect.height*height, borderWidth: 1, borderStyle: "dashed", borderColor: t.primary }}>
        <Image source={{ uri: signature }} style={{ width: "100%", height: "100%" }} resizeMode="stretch" />
        <View {...responder(true).panHandlers} accessibilityLabel="Resize signature" style={{ position: "absolute", bottom: -8, right: -8, width: 36, height: 36, borderRadius: 18, backgroundColor: t.primary, alignItems: "center", justifyContent: "center" }}><Ionicons name="resize-outline" size={20} color={t.bg} /></View>
      </View>
    </View>}
    <Button title="Reset position" compact secondary icon="refresh-outline" disabled={!preview} onPress={() => commit({ left: .1, top: .65, width: .4, height: .4*canvas/height/aspect })} />
  </View>;
}
