import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme";
import { Label } from "./ui";

export function FolioBrand() {
  const t = useTheme();
  return (
    <View>
      <Text
        style={{
          color: t.primary,
          fontSize: 34,
          fontWeight: "900",
          letterSpacing: -2,
        }}
      >
        folio.
      </Text>
      <Label muted size={12}>
        Document Scanner & PDF Editor
      </Label>
    </View>
  );
}

export function FolioIllustration({
  kind = "document",
}: {
  kind?: "document" | "folder" | "profile";
}) {
  const t = useTheme();
  return (
    <View
      accessible={false}
      pointerEvents="none"
      style={{
        width: 100,
        height: 108,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          position: "absolute",
          width: 98,
          height: 90,
          borderRadius: 50,
          backgroundColor: t.tint,
        }}
      />
      <View
        style={{
          position: "absolute",
          width: 62,
          height: 76,
          borderRadius: 13,
          backgroundColor: "#72abff",
          transform: [{ rotate: "-13deg" }],
        }}
      />
      <View
        style={{
          width: 63,
          height: 76,
          borderRadius: 12,
          backgroundColor: t.surface,
          alignItems: "center",
          justifyContent: "center",
          gap: 5,
          transform: [{ rotate: "12deg" }],
          elevation: 4,
          shadowColor: t.primary,
          shadowOpacity: 0.2,
          shadowRadius: 8,
        }}
      >
        <Ionicons
          name={
            kind === "profile"
              ? "person-outline"
              : kind === "folder"
                ? "folder-open-outline"
                : "document-text-outline"
          }
          size={32}
          color={t.primary}
        />
        {kind !== "profile" && (
          <Text
            style={{
              backgroundColor: "#f33f54",
              color: "white",
              borderRadius: 5,
              overflow: "hidden",
              paddingHorizontal: 5,
              fontSize: 11,
              fontWeight: "800",
            }}
          >
            PDF
          </Text>
        )}
      </View>
    </View>
  );
}
