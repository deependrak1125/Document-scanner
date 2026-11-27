import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useSettings } from "../store";
import { useTheme } from "../theme";

const options = [
  ["system", "System", "phone-portrait-outline", "#008bff", "#e3f1ff"],
  ["light", "Light", "sunny-outline", "#e98a00", "#fff3da"],
  ["dark", "Dark", "moon-outline", "#8237d5", "#f2e8ff"],
] as const;

export function AppearanceSettings({ onBack }: { onBack: () => void }) {
  const t = useTheme();
  const selected = useSettings((state) => state.theme);
  const change = useSettings((state) => state.change);

  return (
    <>
      <View style={styles.hero}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Profile"
          onPress={onBack}
          style={styles.back}
        >
          <Ionicons name="arrow-back" size={24} color={t.primary} />
        </Pressable>
        <View style={styles.copy}>
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: t.text }]}
          >
            Appearance
          </Text>
          <Text style={[styles.description, { color: t.muted }]}>
            Personalize the look and feel of the app.
          </Text>
        </View>
        <View accessible={false} pointerEvents="none" style={styles.art}>
          <View style={[styles.sheet, styles.sheetBack]} />
          <View style={[styles.sheet, styles.sheetFront]}>
            <View style={styles.artTop}>
              <MaterialCommunityIcons
                name="palette-outline"
                size={23}
                color="#0766eb"
              />
              <View style={styles.artBody}>
                <View style={styles.artLine} />
                <View style={[styles.artLine, { width: "70%" }]} />
              </View>
            </View>
            <View style={[styles.artLine, { width: "82%" }]} />
            <View style={[styles.artLine, { width: "52%" }]} />
          </View>
        </View>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: t.surface, borderColor: t.line },
        ]}
      >
        <Text
          accessibilityRole="header"
          style={[styles.heading, { color: t.text }]}
        >
          Choose a theme
        </Text>
        <Text style={[styles.description, { color: t.muted }]}>
          Switch between light, dark, or system theme.
        </Text>
        <View accessibilityRole="radiogroup" style={styles.options}>
          {options.map(([value, label, icon, color, tint]) => {
            const active = selected === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                onPress={() => {
                  if (active) return;
                  void change("theme", value).catch(() =>
                    Alert.alert("Couldn't save theme", "Please try again."),
                  );
                }}
                style={({ pressed }) => [
                  styles.option,
                  {
                    backgroundColor: active ? t.tint : t.surface,
                    borderColor: active ? t.primary : t.line,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                {active && (
                  <View style={[styles.check, { backgroundColor: t.primary }]}>
                    <Ionicons
                      name="checkmark"
                      size={14}
                      color={t.dark ? t.bg : "#fff"}
                    />
                  </View>
                )}
                <View
                  style={[
                    styles.icon,
                    { backgroundColor: t.dark ? t.bg : tint },
                  ]}
                >
                  <Ionicons
                    name={icon}
                    size={29}
                    color={t.dark && value === "dark" ? "#bc94f2" : color}
                  />
                </View>
                <Text
                  style={[
                    styles.optionLabel,
                    { color: active ? t.primary : t.text },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  hero: {
    minHeight: 104,
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
  },
  back: {
    width: 34,
    height: 39,
    justifyContent: "center",
    alignItems: "center",
  },
  copy: { flex: 1, gap: 6 },
  title: { fontSize: 29, fontWeight: "900", letterSpacing: -0.8 },
  description: { fontSize: 14, lineHeight: 20 },
  art: { width: "27%", maxWidth: 116, height: 97, marginRight: 3 },
  sheet: {
    position: "absolute",
    borderRadius: 12,
    transform: [{ rotate: "14deg" }],
  },
  sheetBack: {
    left: 16,
    right: 0,
    top: 4,
    height: 82,
    backgroundColor: "#479bf6",
    borderWidth: 3,
    borderColor: "#98c8fd",
  },
  sheetFront: {
    left: 0,
    right: 9,
    top: 14,
    backgroundColor: "#f0f7ff",
    padding: 8,
    gap: 7,
    elevation: 3,
  },
  artTop: { flexDirection: "row", alignItems: "center", gap: 5 },
  artBody: { flex: 1, gap: 5 },
  artLine: { height: 4, borderRadius: 3, backgroundColor: "#b5d4fa" },
  card: { borderRadius: 22, padding: 15, borderWidth: 1, gap: 6 },
  heading: { fontSize: 21, fontWeight: "900", letterSpacing: -0.35 },
  options: { flexDirection: "row", gap: 8, marginTop: 10 },
  option: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 15,
    paddingVertical: 12,
    paddingHorizontal: 3,
    gap: 6,
    minHeight: 91,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  check: {
    position: "absolute",
    right: 5,
    top: 5,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  optionLabel: { fontSize: 15, fontWeight: "800", textAlign: "center" },
});
