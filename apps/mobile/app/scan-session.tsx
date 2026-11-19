import { useEffect, useRef } from "react";
import { ActivityIndicator, BackHandler, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Screen } from "../components/Screen";
import { Button, Label, layout } from "../components/ui";
import { capture, AutoScannerUnavailableError } from "../features/scanner";
import { useDraft } from "../store";
import { useTheme } from "../theme";
import { useState } from "react";

export default function ScanSession() {
  const { mode, fresh, fromOptions } = useLocalSearchParams<{
    mode?: string;
    fresh?: string;
    fromOptions?: string;
  }>();
  const t = useTheme();
  const [error, setError] = useState("");
  const [manualAvailable, setManualAvailable] = useState(false);
  const started = useRef(false);
  const idMode = mode === "id";
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // Give the route a frame to paint before launching the external scanner.
    requestAnimationFrame(() => {
      void capture(idMode)
        .then((pages) => {
          if (!pages.length) {
            router.back();
            return;
          }
          const draft = useDraft.getState();
          if (fresh === "1") draft.clear();
          draft.setIdMode(idMode);
          draft.add(pages);
          router.replace("/editor");
        })
        .catch((reason) => {
          setManualAvailable(reason instanceof AutoScannerUnavailableError);
          setError(
            reason instanceof Error ? reason.message : "Please try again.",
          );
        });
    });
  }, [fresh, idMode]);
  useEffect(() => {
    if (error) return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => true,
    );
    return () => subscription.remove();
  }, [error]);
  return (
    <Screen>
      <View style={{ ...layout.content, flex: 1, justifyContent: "center" }}>
        {error ? (
          <>
            <Label size={23}>Could not open scanner</Label>
            <Label muted>{error}</Label>
            {manualAvailable && (
              <Button
                title={
                  fromOptions === "1" ? "Use Folio camera" : "Scan options"
                }
                onPress={() => {
                  if (fromOptions === "1") {
                    const draft = useDraft.getState();
                    if (fresh === "1") draft.clear();
                    draft.setIdMode(idMode);
                    router.replace({
                      pathname: "/camera",
                      params: { mode: "auto" },
                    });
                  } else router.replace("/scan");
                }}
              />
            )}
            <Button title="Go back" secondary onPress={() => router.back()} />
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color={t.primary} />
            <Label size={22}>Preparing your scan…</Label>
            <Label muted>Review will open when your pages are ready.</Label>
          </>
        )}
      </View>
    </Screen>
  );
}
