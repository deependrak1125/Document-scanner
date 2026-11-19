import { Alert } from "react-native";
import { router } from "expo-router";
import { useDraft } from "../../store";

let opening = false;
/** Tab presses launch once; returning from the editor never reopens the camera. */
export async function launchScanner() {
  if (opening) return;
  opening = true;
  try {
    if (useDraft.getState().pages.length) {
      const action = await new Promise<"continue" | "add" | "cancel">(
        (resolve) => {
          Alert.alert(
            "Continue your scan?",
            "Your captured pages are still here.",
            [
              {
                text: "Cancel",
                style: "cancel",
                onPress: () => resolve("cancel"),
              },
              { text: "Review pages", onPress: () => resolve("continue") },
              { text: "Add pages", onPress: () => resolve("add") },
            ],
            { cancelable: true, onDismiss: () => resolve("cancel") },
          );
        },
      );
      if (action === "cancel") return;
      if (action === "continue") {
        router.push("/editor");
        return;
      }
    }
    router.navigate({
      pathname: "/scan-session",
      params: { mode: useDraft.getState().idMode ? "id" : "document" },
    });
  } finally {
    opening = false;
  }
}
