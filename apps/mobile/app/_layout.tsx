import { IconBadge, SectionHeading } from "../components/experience";
import { useAutoSync } from "../hooks/useAutoSync";
import { refresh } from "../features/auth";
import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import {
  AppState,
  View,
  Modal,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as LocalAuthentication from "expo-local-authentication";
import { useSettings } from "../store";
import { useTheme } from "../theme";
import { Button, Label } from "../components/ui";
import { setting, setSetting } from "../database";
export default function Root() {
  return (
    <SafeAreaProvider>
      <AppRoot />
    </SafeAreaProvider>
  );
}
function AppRoot() {
  useAutoSync();
  const t = useTheme(),
    settings = useSettings(),
    [locked, setLocked] = useState(true),
    [welcome, setWelcome] = useState(false);
  useEffect(() => {
    void refresh().catch(() => {
      /* Offline and guest sessions stay local. */
    });
    void settings.refresh().then(async () => {
      setLocked(await setting("lock", false));
      setWelcome(!(await setting("onboarded", false)));
    });
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background" && useSettings.getState().lock)
        setLocked(true);
    });
    return () => sub.remove();
  }, []);
  if (!settings.ready)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: t.bg,
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
        }}
      >
        <ActivityIndicator size="large" color={t.primary} />
        <Label muted>Opening your workspace…</Label>
      </View>
    );
  if (welcome)
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
        <StatusBar style={t.dark ? "light" : "dark"} />
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            padding: 28,
            gap: 20,
            maxWidth: 620,
            width: "100%",
            alignSelf: "center",
          }}
        >
          <IconBadge icon="scan-outline" large />
          <Label size={40}>Folio.</Label>
          <Label size={28}>Less paper. More possibility.</Label>
          <Label muted>
            Scan, organize, and carry your documents. Scans stay on your device
            unless you choose cloud backup. ID cards always stay local.
          </Label>
          <SectionHeading
            title="Scan in seconds"
            icon="camera-outline"
            subtitle="Capture a page, receipt or ID"
          />
          <SectionHeading
            title="Make it yours"
            icon="color-filter-outline"
            subtitle="Clean up, sign and export"
          />
          <SectionHeading
            title="Private by default"
            icon="shield-checkmark-outline"
            subtitle="No account needed to start"
          />
          <Button
            title="Start using Folio"
            icon="arrow-forward-outline"
            onPress={async () => {
              await setSetting("onboarded", true);
              setWelcome(false);
            }}
          />
        </ScrollView>
      </SafeAreaView>
    );
  return (
    <>
      <StatusBar style={t.dark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.surface },
          headerTintColor: t.text,
          contentStyle: { backgroundColor: t.bg },
          headerShadowVisible: false,
          headerTitleStyle: { fontSize: 18, fontWeight: "600" },
          headerBackTitle: "Back",
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="subscription"
          options={{ title: "Folio Premium" }}
        />
        <Stack.Screen name="office" options={{ title: "Office to PDF" }} />
        <Stack.Screen name="forms" options={{ title: "PDF forms" }} />
        <Stack.Screen name="compare" options={{ title: "Compare PDFs" }} />
        <Stack.Screen name="merge" options={{ title: "Merge PDFs" }} />
        <Stack.Screen name="camera" options={{ title: "Manual scanner" }} />
        <Stack.Screen name="editor" options={{ title: "Review your scan" }} />
        <Stack.Screen name="document/[id]" options={{ title: "Document" }} />
        <Stack.Screen
          name="login"
          options={{ title: "Your Folio account", presentation: "modal" }}
        />
      </Stack>
      <Modal visible={locked} animationType="fade" onRequestClose={() => {}}>
        <SafeAreaProvider>
          <SafeAreaView
            style={{
              flex: 1,
              justifyContent: "center",
              padding: 30,
              gap: 20,
              backgroundColor: t.bg,
            }}
          >
            <IconBadge icon="finger-print-outline" large />
            <Label size={28}>Welcome back.</Label>
            <Label muted>Unlock to access your private documents.</Label>
            <Button
              title="Unlock Folio"
              icon="lock-open-outline"
              onPress={async () => {
                const result = await LocalAuthentication.authenticateAsync({
                  promptMessage: "Unlock Folio",
                  disableDeviceFallback: false,
                });
                if (result.success) setLocked(false);
              }}
            />
          </SafeAreaView>
        </SafeAreaProvider>
      </Modal>
    </>
  );
}
