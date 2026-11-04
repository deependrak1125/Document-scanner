import { View } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
export default function TabLayout() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 10);
  const icons = {
    index: "home-outline",
    documents: "documents-outline",
    scan: "scan",
    tools: "grid-outline",
    profile: "person-outline",
  } as const;
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: t.primary,
        tabBarInactiveTintColor: t.muted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700", marginTop: 4 },
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: t.surface,
          borderTopColor: t.line,
          height: 64 + bottomPadding,
          paddingBottom: bottomPadding,
          paddingTop: 10,
        },
        tabBarIcon: ({ color, size }) => (
          <View
            style={
              route.name === "scan"
                ? {
                    backgroundColor: t.primary,
                    borderRadius: 16,
                    width: 48,
                    height: 40,
                    alignItems: "center",
                    justifyContent: "center",
                  }
                : undefined
            }
          >
            <Ionicons
              name={icons[route.name as keyof typeof icons] ?? "ellipse"}
              color={
                route.name === "scan"
                  ? t.dark
                    ? "#102b24"
                    : "#fff"
                  : typeof color === "string"
                    ? color
                    : t.muted
              }
              size={route.name === "scan" ? 25 : size}
            />
          </View>
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="documents" options={{ title: "Documents" }} />
      <Tabs.Screen name="scan" options={{ title: "Scan" }} />
      <Tabs.Screen name="tools" options={{ title: "PDF tools" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
