import { launchScanner } from "../../features/scanner/launch";
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
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          height: 62 + bottomPadding,
          paddingBottom: bottomPadding,
          paddingTop: 10,
        },
        tabBarIcon: ({ color, size, focused }) => (
          <View
            style={
              route.name === "scan"
                ? {
                    backgroundColor: t.primary,
                    borderRadius: 28,
                    width: 54,
                    height: 54,
                    transform: [{ translateY: -9 }],
                    elevation: 4,
                    alignItems: "center",
                    justifyContent: "center",
                  }
                : {
                    width: 44,
                    height: 32,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: focused ? t.tint : "transparent",
                  }
            }
          >
            <Ionicons
              name={
                route.name === "index" && focused
                  ? "home"
                  : route.name === "documents" && focused
                    ? "folder"
                    : route.name === "profile" && focused
                      ? "person"
                      : (icons[route.name as keyof typeof icons] ?? "ellipse")
              }
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
      <Tabs.Screen
        name="scan"
        options={{ title: "Scan" }}
        listeners={{
          tabPress: (event) => {
            event.preventDefault();
            void launchScanner();
          },
        }}
      />
      <Tabs.Screen name="tools" options={{ title: "PDF Tools" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
