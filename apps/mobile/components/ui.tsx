import { useRef, useState } from "react";
import {
  Text,
  View,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme";
export function Label({
  children,
  muted = false,
  size = 16,
}: {
  children: React.ReactNode;
  muted?: boolean;
  size?: number;
}) {
  const t = useTheme();
  return (
    <Text
      style={{
        color: muted ? t.muted : t.text,
        fontSize: size,
        fontWeight: size >= 19 ? "700" : "400",
        letterSpacing: size >= 24 ? -0.7 : 0,
        lineHeight: size * 1.45,
      }}
    >
      {children}
    </Text>
  );
}
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.surface,
          padding: 20,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: t.line,
          gap: 12,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Button({
  title,
  onPress,
  secondary = false,
  danger = false,
  disabled = false,
  icon,
  compact = false,
}: {
  title: string;
  onPress: () => void | Promise<unknown>;
  secondary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  compact?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
}) {
  const t = useTheme();
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={() => {
        if (pending.current) return;
        pending.current = true;
        setBusy(true);
        Promise.resolve()
          .then(onPress)
          .catch((e) =>
            Alert.alert(
              "Unable to complete",
              e instanceof Error ? e.message : "Please try again.",
            ),
          )
          .finally(() => {
            pending.current = false;
            setBusy(false);
          });
      }}
      style={({ pressed }) => ({
        minHeight: compact ? 60 : 52,
        borderRadius: 16,
        paddingHorizontal: compact ? 10 : 16,
        paddingVertical: compact ? 8 : 12,
        flexDirection: compact ? "column" : "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: secondary ? t.tint : danger ? t.danger : t.primary,
        opacity: disabled || busy ? 0.5 : pressed ? 0.7 : 1,
      })}
    >
      {busy ? (
        <ActivityIndicator
          color={
            secondary
              ? t.primary
              : danger
                ? "#fff"
                : t.dark
                  ? "#102b24"
                  : "#fff"
          }
        />
      ) : (
        <>
          {icon && (
            <Ionicons
              name={icon}
              size={20}
              color={
                secondary
                  ? t.primary
                  : danger
                    ? "#fff"
                    : t.dark
                      ? "#102b24"
                      : "#fff"
              }
            />
          )}
          <Text
            style={{
              color: secondary
                ? t.primary
                : danger
                  ? "#fff"
                  : t.dark
                    ? "#102b24"
                    : "#fff",
              fontWeight: "700",
              fontSize: compact ? 11 : 14,
            }}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}
export function Field({
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  multiline = false,
}: {
  value: string;
  onChangeText: (s: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  multiline?: boolean;
}) {
  const t = useTheme();
  return (
    <TextInput
      accessibilityLabel={placeholder}
      placeholder={placeholder}
      placeholderTextColor={t.muted}
      keyboardType={
        placeholder.toLowerCase().includes("email")
          ? "email-address"
          : "default"
      }
      autoCorrect={
        !secureTextEntry && !placeholder.toLowerCase().includes("email")
      }
      value={value}
      onChangeText={onChangeText}
      secureTextEntry={secureTextEntry}
      multiline={multiline}
      autoCapitalize={
        secureTextEntry || placeholder.toLowerCase().includes("email")
          ? "none"
          : "sentences"
      }
      style={{
        backgroundColor: t.surface,
        borderColor: t.line,
        borderWidth: 1,
        borderRadius: 16,
        padding: 14,
        minHeight: 50,
        color: t.text,
        fontSize: 16,
      }}
    />
  );
}
export const layout = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 22, gap: 18, paddingBottom: 40 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  heading: { fontSize: 30, fontWeight: "800", letterSpacing: -1 },
});
