import type { ReactNode } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../theme";

// Stack headers handle the top inset; screen content handles the other edges.
export function Screen({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <SafeAreaView
      edges={["left", "right", "bottom"]}
      style={{ flex: 1, backgroundColor: theme.bg }}
    >
      {children}
    </SafeAreaView>
  );
}
