import { Alert } from "react-native";
import { useDraft } from "../../store";

export function confirmReplaceDraft(): Promise<boolean> {
  if (!useDraft.getState().pages.length) return Promise.resolve(true);
  return new Promise((resolve) => {
    Alert.alert(
      "Replace your unsaved scan?",
      "Your current pages will be replaced. You can continue editing them from the Scan tab.",
      [
        { text: "Keep pages", style: "cancel", onPress: () => resolve(false) },
        { text: "Replace", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
