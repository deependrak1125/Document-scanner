import { useColorScheme } from "react-native";
import { useSettings } from "../store";
export function useTheme() {
  const system = useColorScheme(),
    choice = useSettings((s) => s.theme);
  const dark = choice === "dark" || (choice === "system" && system === "dark");
  return {
    dark,
    bg: dark ? "#101c21" : "#f1f5ff",
    surface: dark ? "#1a2a31" : "#ffffff",
    text: dark ? "#f2f7f8" : "#0c1935",
    muted: dark ? "#9db0ba" : "#63758a",
    line: dark ? "#30434b" : "#e3eaf2",
    primary: dark ? "#58d3bf" : "#0657e8",
    tint: dark ? "#163d3a" : "#eaf2ff",
    danger: "#d64d5b",
  };
}
