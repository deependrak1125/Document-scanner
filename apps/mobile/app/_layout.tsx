import { useAutoSync } from "../hooks/useAutoSync";
import { refresh } from "../features/auth";
import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { AppState, View, Modal } from "react-native";
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
    return <View style={{ flex: 1, backgroundColor: t.bg }} />;
  if (welcome)
    return (
      <SafeAreaView
        style={{
          flex: 1,
          justifyContent: "center",
          padding: 30,
          gap: 24,
          backgroundColor: t.bg,
        }}
      >
        <Label size={48}>Folio.</Label>
        <Label size={28}>Less paper. More possibility.</Label>
        <Label muted>
          Scan, organize, and carry your documents. Scans stay on your device
          unless you choose cloud backup. ID cards always stay local.
        </Label>
        <Label muted>
          Camera access is requested when you scan. No account is needed.
        </Label>
        <Button
          title="Continue without an account"
          onPress={async () => {
            await setSetting("onboarded", true);
            setWelcome(false);
          }}
        />
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
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="subscription"
          options={{ title: "Folio Premium" }}
        />
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
            <Label size={30}>Your documents, protected.</Label>
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
