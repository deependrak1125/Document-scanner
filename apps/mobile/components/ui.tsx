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
  numberOfLines,
}: {
  children: React.ReactNode;
  muted?: boolean;
  size?: number;
  numberOfLines?: number;
}) {
  const t = useTheme();
  return (
    <Text
      numberOfLines={numberOfLines}
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
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const search = placeholder.toLowerCase().includes("search");
  const email = placeholder.toLowerCase().includes("email");
  return (
    <View style={{ gap: 7 }}>
      {!search && (
        <Text style={{ color: t.muted, fontSize: 12, fontWeight: "600" }}>
          {placeholder}
        </Text>
      )}
      <View
        style={{
          flexDirection: "row",
          alignItems: multiline ? "flex-start" : "center",
          backgroundColor: t.surface,
          borderColor: focused ? t.primary : t.line,
          borderWidth: 1,
          borderRadius: 14,
          paddingHorizontal: 14,
        }}
      >
        {(search || email || secureTextEntry) && (
          <Ionicons
            name={
              search
                ? "search-outline"
                : email
                  ? "mail-outline"
                  : "lock-closed-outline"
            }
            size={20}
            color={focused ? t.primary : t.muted}
          />
        )}
        <TextInput
          accessibilityLabel={placeholder}
          placeholder={search ? placeholder : ""}
          placeholderTextColor={t.muted}
          keyboardType={email ? "email-address" : "default"}
          autoCorrect={!secureTextEntry && !email && !search}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          secureTextEntry={secureTextEntry && !revealed}
          multiline={multiline}
          autoCapitalize={secureTextEntry || email ? "none" : "sentences"}
          style={{
            flex: 1,
            padding: 12,
            paddingHorizontal: search || email || secureTextEntry ? 10 : 0,
            minHeight: multiline ? 112 : 50,
            color: t.text,
            fontSize: 15,
            textAlignVertical: multiline ? "top" : "center",
          }}
        />
        {secureTextEntry && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? "Hide password" : "Show password"}
            onPress={() => setRevealed(!revealed)}
            style={{ padding: 12 }}
          >
            <Ionicons
              name={revealed ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={t.muted}
            />
          </Pressable>
        )}
        {search && !!value && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            onPress={() => onChangeText("")}
            style={{ padding: 12 }}
          >
            <Ionicons name="close-circle" size={20} color={t.muted} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

export const layout = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    padding: 20,
    gap: 18,
    paddingBottom: 32,
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  heading: { fontSize: 30, fontWeight: "800", letterSpacing: -1 },
});
