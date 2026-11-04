import { useTheme } from "../theme";
import { Screen } from "../components/Screen";
import { useState, useCallback, useEffect } from "react";
import { View, AppState, Linking } from "react-native";
import { useFocusEffect, router } from "expo-router";
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
} from "react-native-vision-camera";
import { Button, Label, layout } from "../components/ui";
import { useDraft, useSettings } from "../store";
import { makePage } from "../features/scanner";
export default function ManualCamera() {
  return (
    <Screen>
      <ManualCameraContent />
    </Screen>
  );
}
function ManualCameraContent() {
  const theme = useTheme();
  const device = useCameraDevice("back"),
    permission = useCameraPermission(),
    quality = useSettings((s) => s.quality),
    pages = useDraft((s) => s.pages);
  const output = usePhotoOutput({
    containerFormat: "jpeg",
    quality: quality / 100,
    qualityPrioritization: "quality",
  });
  const [focused, setFocused] = useState(false),
    [foreground, setForeground] = useState(AppState.currentState === "active"),
    [ready, setReady] = useState(false),
    [flash, setFlash] = useState(false),
    [error, setError] = useState("");
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) =>
      setForeground(state === "active"),
    );
    return () => listener.remove();
  }, []);
  if (!permission.hasPermission)
    return (
      <View style={layout.content}>
        <Label size={24}>Camera access, only when you need it.</Label>
        <Label muted>
          Capture stays on this device. You can also import a file without
          camera permission.
        </Label>
        <Button
          title={
            permission.canRequestPermission
              ? "Allow camera"
              : "Open camera settings"
          }
          onPress={() =>
            permission.canRequestPermission
              ? permission.requestPermission()
              : Linking.openSettings()
          }
        />
      </View>
    );
  if (!device)
    return (
      <View style={layout.content}>
        <Label>No back camera is available on this device.</Label>
      </View>
    );
  return (
    <View style={{ flex: 1, backgroundColor: "#111f24" }}>
      <Camera
        style={{ flex: 1 }}
        device={device}
        outputs={[output]}
        isActive={focused && foreground}
        onStarted={() => setReady(true)}
        onStopped={() => setReady(false)}
        onError={(e) => setError(String(e))}
        enableNativeZoomGesture
        enableNativeTapToFocusGesture
      />
      <View style={{ padding: 22, gap: 14, backgroundColor: theme.surface }}>
        <Label>{pages.length} pages captured · Manual camera</Label>
        {error && <Label>{error}</Label>}
        <Button
          title={flash ? "Flash on" : "Flash off"}
          secondary
          onPress={() => setFlash(!flash)}
        />
        <Button
          title="Capture page"
          icon="camera"
          disabled={!ready || !focused || !foreground}
          onPress={async () => {
            const file = await output.capturePhotoToFile(
              { flashMode: flash ? "on" : "off" },
              {},
            );
            const page = await makePage(
              file.filePath.startsWith("file:")
                ? file.filePath
                : `file://${file.filePath}`,
            );
            useDraft.getState().add([page]);
          }}
        />
        <Button
          title="Review & crop pages"
          secondary
          disabled={!pages.length}
          onPress={() => router.replace("/editor")}
        />
      </View>
    </View>
  );
}
