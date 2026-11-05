import { useMemo, useRef, useState } from "react";
import { View, Image, PanResponder, useWindowDimensions } from "react-native";
import Svg, { Polygon, Circle } from "react-native-svg";
import type { Corner } from "../native/image";
import { Button, Label } from "./ui";
export function CropEditor({
  uri,
  width,
  height,
  onApply,
}: {
  uri: string;
  width: number;
  height: number;
  onApply: (corners: Corner[]) => Promise<void>;
}) {
  const window = useWindowDimensions();
  const [availableWidth, setAvailableWidth] = useState(
    Math.min(window.width - 40, 720),
  );
  const w = availableWidth,
    h = Math.min(400, (w * height) / width),
    iw = Math.min(w, (h * width) / height),
    ih = (iw * height) / width;
  const [points, setPoints] = useState<Corner[]>([
    [0.03, 0.03],
    [0.97, 0.03],
    [0.97, 0.97],
    [0.03, 0.97],
  ]);
  const latest = useRef(points);
  latest.current = points;
  const starts = useRef<Corner[]>(points);
  const responders = useMemo(
    () =>
      [0, 1, 2, 3].map((index) =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onPanResponderTerminationRequest: () => false,
          onPanResponderGrant: () => {
            starts.current[index] = [...latest.current[index]];
          },
          onPanResponderMove: (_, g) =>
            setPoints((previous) =>
              previous.map((point, i) =>
                i === index
                  ? [
                      Math.max(
                        0,
                        Math.min(1, starts.current[index][0] + g.dx / iw),
                      ),
                      Math.max(
                        0,
                        Math.min(1, starts.current[index][1] + g.dy / ih),
                      ),
                    ]
                  : point,
              ),
            ),
        }),
      ),
    [iw, ih],
  );
  return (
    <View
      style={{ gap: 12 }}
      onLayout={(event) => setAvailableWidth(event.nativeEvent.layout.width)}
    >
      <Label muted>Drag each corner to the edge of the paper.</Label>
      <View style={{ width: iw, height: ih, alignSelf: "center" }}>
        <Image source={{ uri }} style={{ width: iw, height: ih }} />
        <Svg
          width={iw}
          height={ih}
          style={{ position: "absolute" }}
          pointerEvents="none"
        >
          <Polygon
            points={points.map((p) => `${p[0] * iw},${p[1] * ih}`).join(" ")}
            fill="#008c7c22"
            stroke="#25dbc0"
            strokeWidth={2}
          />
          {points.map((p, i) => (
            <Circle key={i} cx={p[0] * iw} cy={p[1] * ih} r={6} fill="white" />
          ))}
        </Svg>
        {points.map((p, index) => {
          return (
            <View
              key={index}
              accessibilityLabel={`Crop corner ${index + 1}`}
              {...responders[index].panHandlers}
              style={{
                position: "absolute",
                left: p[0] * iw - 22,
                top: p[1] * ih - 22,
                width: 44,
                height: 44,
              }}
            />
          );
        })}
      </View>
      <Button
        title="Apply perspective crop"
        onPress={() => {
          const cross = points.map((a, i) => {
            const b = points[(i + 1) % 4],
              c = points[(i + 2) % 4];
            return (
              (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])
            );
          });
          if (cross.some((v) => v <= 0.001))
            throw new Error(
              "Keep the corners in clockwise order without crossing.",
            );
          return onApply(points);
        }}
      />
    </View>
  );
}
