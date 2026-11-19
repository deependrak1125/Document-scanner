import { useRef, useState } from "react";
import { View, PanResponder } from "react-native";
import { useTheme } from "../theme";
import { Label } from "./ui";

export function AdjustmentSlider({
  label,
  value,
  min,
  max,
  disabled,
  onChange,
  onDragging,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled: boolean;
  onChange: (value: number) => void;
  onDragging: (active: boolean) => void;
}) {
  const t = useTheme();
  const [width, setWidth] = useState(1);
  const latest = useRef({ width, min, max, disabled, onChange, onDragging });
  latest.current = { width, min, max, disabled, onChange, onDragging };
  const start = useRef(0);
  const [pan] = useState(() => {
    const update = (x: number) => {
      const current = latest.current;
      const fraction = Math.max(0, Math.min(1, x / current.width));
      current.onChange(
        Math.round(
          (current.min + fraction * (current.max - current.min)) * 100,
        ) / 100,
      );
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => !latest.current.disabled,
      onPanResponderGrant: (event) => {
        start.current = event.nativeEvent.locationX;
        latest.current.onDragging(true);
        update(start.current);
      },
      onPanResponderMove: (_, gesture) => update(start.current + gesture.dx),
      onPanResponderRelease: () => latest.current.onDragging(false),
      onPanResponderTerminate: () => latest.current.onDragging(false),
      onPanResponderTerminationRequest: () => false,
    });
  });
  const fraction = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return (
    <View>
      <Label>
        {label} · {Math.round(value * 100)}%
      </Label>
      <View
        {...pan.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        accessibilityValue={{
          min: min * 100,
          max: max * 100,
          now: Math.round(value * 100),
        }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(event) => {
          if (!disabled)
            onChange(
              Math.max(
                min,
                Math.min(
                  max,
                  value +
                    (event.nativeEvent.actionName === "increment"
                      ? 0.05
                      : -0.05),
                ),
              ),
            );
        }}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        style={{
          height: 44,
          justifyContent: "center",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <View
          pointerEvents="none"
          style={{ height: 4, borderRadius: 2, backgroundColor: t.line }}
        >
          <View
            style={{
              width: width * fraction,
              height: 4,
              backgroundColor: t.primary,
              borderRadius: 2,
            }}
          />
          <View
            style={{
              position: "absolute",
              top: -7,
              left: Math.max(0, Math.min(width - 18, width * fraction - 9)),
              width: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: t.primary,
            }}
          />
        </View>
      </View>
    </View>
  );
}
