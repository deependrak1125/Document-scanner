import { useMemo, useRef, useState } from "react";
import { View, PanResponder } from "react-native";
import Svg, { Path } from "react-native-svg";
import ViewShot from "react-native-view-shot";
import { Button, Label, layout } from "./ui";
export function SignaturePad({
  onSave,
  onDrawing,
}: {
  onSave: (uri: string) => Promise<void>;
  onDrawing?: (active: boolean) => void;
}) {
  const ref = useRef<React.ComponentRef<typeof ViewShot>>(null),
    [paths, setPaths] = useState<string[]>([]),
    [color, setColor] = useState("#18334a");
  const active = useRef("");
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          onDrawing?.(true);
          active.current = `M ${e.nativeEvent.locationX} ${e.nativeEvent.locationY}`;
          setPaths((p) => [...p, active.current]);
        },
        onPanResponderMove: (e) => {
          active.current += ` L ${e.nativeEvent.locationX} ${e.nativeEvent.locationY}`;
          setPaths((p) => [...p.slice(0, -1), active.current]);
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: () => onDrawing?.(false),
        onPanResponderTerminate: () => onDrawing?.(false),
      }),
    [onDrawing],
  );
  return (
    <View style={{ gap: 12 }}>
      <Label>Draw your signature below</Label>
      <View style={{ borderWidth: 1, borderColor: "#c5d7dd", borderRadius: 8 }}>
        <ViewShot
          ref={ref}
          options={{ format: "png", quality: 1, result: "tmpfile" }}
          style={{ backgroundColor: "transparent" }}
        >
          <View
            {...responder.panHandlers}
            style={{
              height: 170,
            }}
          >
            <Svg width="100%" height="100%">
              {paths.map((p, i) => (
                <Path
                  key={i}
                  d={p}
                  stroke={color}
                  strokeWidth={2.5}
                  fill="none"
                  strokeLinecap="round"
                />
              ))}
            </Svg>
          </View>
        </ViewShot>
      </View>
      <View style={layout.wrap}>
        <Button title="Clear" secondary onPress={() => setPaths([])} />
        <Button
          title={color === "#18334a" ? "Use blue" : "Use black"}
          secondary
          onPress={() => setColor(color === "#18334a" ? "#1655b8" : "#18334a")}
        />
        <Button
          title="Save signature"
          disabled={!paths.length}
          onPress={async () => {
            const uri = await ref.current?.capture?.();
            if (!uri) throw new Error("Signature capture failed.");
            await onSave(uri);
          }}
        />
      </View>
      <Label muted size={11}>
        A handwritten image signature, not a certificate-based digital
        signature.
      </Label>
    </View>
  );
}
