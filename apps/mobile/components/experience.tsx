import { useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme";
type Icon = React.ComponentProps<typeof Ionicons>["name"];
export function PageHeading({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  const t = useTheme();
  return (
    <View style={{ gap: 8 }}>
      {eyebrow && (
        <Text
          style={{
            color: t.primary,
            fontSize: 11,
            fontWeight: "800",
            letterSpacing: 2,
          }}
        >
          {eyebrow.toUpperCase()}
        </Text>
      )}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Text
          accessibilityRole="header"
          style={{
            flex: 1,
            color: t.text,
            fontSize: 32,
            fontWeight: "800",
            letterSpacing: -1.2,
          }}
        >
          {title}
        </Text>
        {action}
      </View>
      {subtitle && (
        <Text style={{ color: t.muted, fontSize: 15, lineHeight: 22 }}>
          {subtitle}
        </Text>
      )}
    </View>
  );
}
export function Chip({
  title,
  selected = false,
  icon,
  onPress,
}: {
  title: string;
  selected?: boolean;
  icon?: Icon;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: selected ? t.primary : t.line,
        backgroundColor: selected ? t.tint : t.surface,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={16}
          color={selected ? t.primary : t.muted}
        />
      )}
      <Text
        style={{
          color: selected ? t.primary : t.muted,
          fontSize: 13,
          fontWeight: "700",
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function ActionCard({
  title,
  description,
  icon,
  onPress,
  accent = false,
  tile = false,
}: {
  title: string;
  description: string;
  icon: Icon;
  onPress: () => unknown | Promise<unknown>;
  accent?: boolean;
  tile?: boolean;
}) {
  const t = useTheme(),
    [busy, setBusy] = useState(false),
    pending = useRef(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${description}`}
      accessibilityState={{ busy, disabled: busy }}
      disabled={busy}
      onPress={() => {
        if (pending.current) return;
        pending.current = true;
        setBusy(true);
        void Promise.resolve()
          .then(onPress)
          .catch((e) =>
            Alert.alert(
              "Couldn't finish",
              e instanceof Error ? e.message : "Please try again.",
            ),
          )
          .finally(() => {
            pending.current = false;
            setBusy(false);
          });
      }}
      style={({ pressed }) => ({
        padding: tile ? 15 : 18,
        width: tile ? "48%" : undefined,
        minHeight: tile ? 172 : undefined,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: accent ? t.primary : t.line,
        backgroundColor: accent ? t.tint : t.surface,
        flexDirection: tile ? "column" : "row",
        alignItems: tile ? "flex-start" : "center",
        gap: 14,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <View
        style={{
          width: 46,
          height: 46,
          borderRadius: 16,
          backgroundColor: accent ? t.surface : t.tint,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {busy ? (
          <ActivityIndicator color={t.primary} />
        ) : (
          <Ionicons name={icon} size={23} color={t.primary} />
        )}
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: t.text, fontSize: 16, fontWeight: "700" }}>
          {title}
        </Text>
        <Text style={{ color: t.muted, fontSize: 12, lineHeight: 18 }}>
          {description}
        </Text>
      </View>
      {!tile && <Ionicons name="chevron-forward" size={18} color={t.muted} />}
    </Pressable>
  );
}
export function Notice({
  message,
  error = false,
}: {
  message: string;
  error?: boolean;
}) {
  const t = useTheme();
  return (
    <View
      accessibilityRole={error ? "alert" : "text"}
      style={{
        padding: 14,
        borderRadius: 16,
        backgroundColor: t.tint,
        flexDirection: "row",
        gap: 10,
        alignItems: "center",
      }}
    >
      <Ionicons
        name={error ? "alert-circle-outline" : "shield-checkmark-outline"}
        size={20}
        color={error ? t.danger : t.primary}
      />
      <Text
        style={{
          flex: 1,
          color: error ? t.danger : t.muted,
          fontSize: 12,
          lineHeight: 18,
        }}
      >
        {message}
      </Text>
    </View>
  );
}

export function Disclosure({
  title,
  description,
  children,
  initiallyOpen = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  initiallyOpen?: boolean;
}) {
  const t = useTheme(),
    [open, setOpen] = useState(initiallyOpen);
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: t.line,
        borderRadius: 22,
        backgroundColor: t.surface,
        overflow: "hidden",
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={{
          padding: 18,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: t.text, fontSize: 17, fontWeight: "700" }}>
            {title}
          </Text>
          {description && (
            <Text style={{ color: t.muted, fontSize: 12, lineHeight: 18 }}>
              {description}
            </Text>
          )}
        </View>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          color={t.primary}
          size={20}
        />
      </Pressable>
      {open && (
        <View style={{ padding: 18, paddingTop: 0, gap: 14 }}>{children}</View>
      )}
    </View>
  );
}
