import { IconBadge, PageHeading, Notice } from "../components/experience";
import { useTheme } from "../theme";
import { Screen } from "../components/Screen";
import { useState, useCallback, useEffect, useRef } from "react";
import { View, AppState, Linking } from "react-native";
import { useFocusEffect, useLocalSearchParams, router } from "expo-router";
import { Button, Label, layout } from "../components/ui";
import { useDraft, useSettings } from "../store";
import { autoEnhancePage, makePage } from "../features/scanner";

type VisionCameraModule = {
  Camera: React.ComponentType<{
    style: object;
    device: unknown;
    outputs: unknown[];
    isActive: boolean;
    onStarted?: () => void;
    onStopped?: () => void;
    onError?: (error: unknown) => void;
    enableNativeZoomGesture?: boolean;
    enableNativeTapToFocusGesture?: boolean;
  }>;
  useCameraDevice: (position: "back" | "front") => unknown;
  useCameraPermission: () => {
    hasPermission: boolean;
    canRequestPermission: boolean;
    requestPermission: () => Promise<boolean>;
  };
  usePhotoOutput: (options: {
    containerFormat: "jpeg";
    quality: number;
    qualityPrioritization: "quality";
  }) => {
    capturePhotoToFile: (
      options: { flashMode: "on" | "off" },
      context: Record<string, never>,
    ) => Promise<{ filePath: string }>;
  };
};

function loadVisionCamera(): VisionCameraModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("react-native-vision-camera") as VisionCameraModule;
  } catch {
    return null;
  }
}

const VisionCamera = loadVisionCamera();

export default function ManualCamera() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  if (!VisionCamera)
    return (
      <Screen>
        <View style={layout.content}>
          <IconBadge icon="camera-outline" large />
          <PageHeading
            title="Folio camera needs the native app"
            subtitle="Expo Go cannot load the native camera module."
          />
          <Label muted>
            Install the Folio development build, or return to Scan and choose
            photos instead.
          </Label>
          <Button
            title="Back to scan"
            icon="arrow-back-outline"
            onPress={() => router.replace("/(tabs)/scan")}
          />
        </View>
      </Screen>
    );
  return (
    <Screen>
      <ManualCameraContent
        native={VisionCamera}
        autoEnhance={mode === "auto"}
      />
    </Screen>
  );
}
function ManualCameraContent({
  native,
  autoEnhance,
}: {
  native: VisionCameraModule;
  autoEnhance: boolean;
}) {
  const { Camera, useCameraDevice, useCameraPermission, usePhotoOutput } =
    native;
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
  const capturing = useRef(false);
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (leaving) router.replace("/editor");
  }, [leaving]);
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
        <IconBadge icon="camera-outline" large />
        <PageHeading
          title="Ready when you are"
          subtitle="Allow camera access to scan a page."
        />
        <Label muted>
          Capture stays on this device. You can also import a file without
          camera permission.
        </Label>
        <Button
          icon="camera-outline"
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
      <View style={{ flex: 1 }}>
        {!leaving && (
          <Camera
            style={{ flex: 1 }}
            device={device}
            outputs={[output]}
            isActive={focused && foreground}
            onStarted={() => setReady(true)}
            onStopped={() => setReady(false)}
            onError={(e: unknown) => setError(String(e))}
            enableNativeZoomGesture
            enableNativeTapToFocusGesture
          />
        )}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: "12%",
            left: "8%",
            right: "8%",
            bottom: "12%",
            borderWidth: 1.5,
            borderColor: "#ffffffaa",
            borderRadius: 18,
          }}
        />
      </View>
      <View style={{ padding: 20, gap: 12, backgroundColor: theme.surface }}>
        <Label>
          {pages.length} pages captured ·{" "}
          {autoEnhance ? "Auto enhance" : "Manual camera"}
        </Label>
        {autoEnhance && (
          <Label muted size={12}>
            Folio finds page edges after capture, crops the page when found and
            applies Clean color. You can adjust everything in Review.
          </Label>
        )}
        {error && <Notice error message={error} />}
        <Button
          icon={flash ? "flash" : "flash-off-outline"}
          title={flash ? "Flash on" : "Flash off"}
          secondary
          onPress={() => setFlash(!flash)}
        />
        <Button
          title={autoEnhance ? "Capture & enhance" : "Capture page"}
          icon="camera"
          disabled={busy || leaving || !ready || !focused || !foreground}
          onPress={async () => {
            if (capturing.current) return;
            capturing.current = true;
            setBusy(true);
            try {
              const file = await output.capturePhotoToFile(
                { flashMode: flash ? "on" : "off" },
                {},
              );
              let page = await makePage(
                file.filePath.startsWith("file:")
                  ? file.filePath
                  : `file://${file.filePath}`,
              );
              if (autoEnhance) {
                try {
                  page = await autoEnhancePage(page);
                  setError("");
                } catch {
                  setError(
                    "Automatic enhancement was unavailable. The original photo is ready; crop and filter it in Review.",
                  );
                }
              }
              useDraft.getState().add([page]);
            } finally {
              capturing.current = false;
              setBusy(false);
            }
          }}
        />
        <Button
          title={`Review ${pages.length} ${pages.length === 1 ? "page" : "pages"}`}
          icon="checkmark-circle-outline"
          secondary
          disabled={!pages.length || busy || leaving}
          onPress={() => {
            if (!capturing.current) setLeaving(true);
          }}
        />
      </View>
    </View>
  );
}
