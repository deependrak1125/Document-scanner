import { useEffect, useState } from "react";
import {
  Image,
  ScrollView,
  Pressable,
  View,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImageManipulator from "expo-image-manipulator";
import * as FS from "expo-file-system/legacy";
import type { Filter, ScanPage } from "@folio/shared-types";
import { processImage } from "../native/image";
import { useTheme } from "../theme";
import { Label } from "./ui";
const presets: [Filter, string][] = [
  ["original", "Original"],
  ["clean", "Clean color"],
  ["enhanced", "No shadows"],
  ["color", "Vivid"],
  ["grayscale", "Gray"],
  ["bw", "B&W"],
  ["soft", "Soft"],
  ["sharpen", "Sharp"],
];
export function FilterStrip({
  page,
  disabled,
  onSelect,
}: {
  page: ScanPage;
  disabled: boolean;
  onSelect: (filter: Filter) => Promise<void>;
}) {
  const t = useTheme();
  const [previews, setPreviews] = useState<Partial<Record<Filter, string>>>({});
  const [failed, setFailed] = useState(false);
  const base = page.editBaseUri ?? page.uri;
  useEffect(() => {
    let active = true;
    const files: string[] = [];
    setPreviews({});
    setFailed(false);
    void (async () => {
      const small = await ImageManipulator.manipulateAsync(
        base,
        [{ resize: { width: 160 } }],
        { format: ImageManipulator.SaveFormat.JPEG },
      );
      files.push(small.uri);
      for (const [filter] of presets) {
        if (!active) break;
        const result =
          filter === "original"
            ? small
            : await processImage(
                { ...page, ...small, editBaseUri: small.uri },
                filter,
                0,
                1,
              );
        if (result.uri !== small.uri) files.push(result.uri);
        if (active) setPreviews((p) => ({ ...p, [filter]: result.uri }));
      }
    })()
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => {
        if (!active)
          files.forEach(
            (uri) =>
              void FS.deleteAsync(uri, { idempotent: true }).catch(() => {}),
          );
      });
    return () => {
      active = false;
      files.forEach(
        (uri) => void FS.deleteAsync(uri, { idempotent: true }).catch(() => {}),
      );
    };
    // Appearance adjustments do not change the unfiltered preview source.
  }, [base]);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 12 }}
    >
      {presets.map(([filter, title]) => (
        <Pressable
          key={filter}
          accessibilityRole="button"
          accessibilityLabel={`${title} filter`}
          accessibilityState={{ selected: page.filter === filter, disabled }}
          disabled={disabled}
          onPress={() =>
            void onSelect(filter).catch((e) =>
              Alert.alert(
                "Filter failed",
                e instanceof Error ? e.message : "Try again.",
              ),
            )
          }
          style={{ width: 84, gap: 7, opacity: disabled ? 0.55 : 1 }}
        >
          <View
            style={{
              height: 108,
              backgroundColor: t.tint,
              borderRadius: 14,
              overflow: "hidden",
              borderWidth: 2,
              borderColor: page.filter === filter ? t.primary : t.line,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {previews[filter] ? (
              <Image
                source={{ uri: previews[filter] }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />
            ) : failed ? (
              <Ionicons name="image-outline" size={24} color={t.muted} />
            ) : (
              <ActivityIndicator color={t.primary} />
            )}
            {page.filter === filter && (
              <View
                style={{
                  position: "absolute",
                  right: 4,
                  bottom: 4,
                  backgroundColor: t.primary,
                  borderRadius: 12,
                }}
              >
                <Ionicons name="checkmark-circle" size={22} color={t.bg} />
              </View>
            )}
          </View>
          <Label size={12}>{title}</Label>
        </Pressable>
      ))}
    </ScrollView>
  );
}
