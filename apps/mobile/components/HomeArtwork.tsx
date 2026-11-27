import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Rect,
  Path,
  G,
  Text,
} from "react-native-svg";

export function FillGradient({ colors }: { colors: [string, string] }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: colors[1] }]}
      onLayout={({
        nativeEvent: {
          layout: { width, height },
        },
      }) => {
        setSize((current) =>
          current.width === width && current.height === height
            ? current
            : { width, height },
        );
      }}
    >
      {size.width > 0 && size.height > 0 && (
        <Svg
          width={size.width}
          height={size.height}
          style={StyleSheet.absoluteFill}
        >
          <Defs>
            <LinearGradient id="fill" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0" stopColor={colors[0]} />
              <Stop offset="1" stopColor={colors[1]} />
            </LinearGradient>
          </Defs>
          <Rect width={size.width} height={size.height} fill="url(#fill)" />
        </Svg>
      )}
    </View>
  );
}

export function HomeWaves({
  fadeBottom = false,
}: { fadeBottom?: boolean } = {}) {
  return (
    <Svg
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
      viewBox="0 0 400 235"
      preserveAspectRatio="none"
    >
      <Defs>
        <LinearGradient
          id="wave"
          x1="0%"
          y1="0%"
          x2={fadeBottom ? "0%" : "100%"}
          y2={fadeBottom ? "100%" : "0%"}
        >
          <Stop offset="0" stopColor="#aff0ff" />
          <Stop offset="0.55" stopColor="#c4ccff" />
          <Stop
            offset="1"
            stopColor="#a6c2ff"
            stopOpacity={fadeBottom ? 0 : 1}
          />
        </LinearGradient>
      </Defs>
      <Path
        d="M0 166 C102 190 95 225 208 215 C286 207 360 192 400 131 L400 235 H0Z"
        fill="url(#wave)"
        opacity={0.6}
      />
      <Path
        d="M0 219 C88 154 125 190 213 219 C279 239 362 214 400 177 L400 235 H0Z"
        fill="url(#wave)"
        opacity={0.75}
      />
    </Svg>
  );
}

export function ScanArtwork({
  phone = false,
  workspace = false,
  documentLabel = "PDF",
}: {
  phone?: boolean;
  workspace?: boolean;
  documentLabel?: "PDF" | "EULA";
}) {
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={phone || workspace ? "-9 -8 169 180" : "0 0 150 165"}
      pointerEvents="none"
    >
      <Defs>
        <LinearGradient id="glass" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0" stopColor="#eef8ff" />
          <Stop offset="1" stopColor="#9ab6f5" />
        </LinearGradient>
        <LinearGradient id="sheet" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0" stopColor="#fff" />
          <Stop offset="1" stopColor="#d5e5ff" />
        </LinearGradient>
      </Defs>
      {workspace && (
        <Path
          d="M8 144C-9 123 37 107 83 100C131 93 157 68 135 60C173 65 170 94 125 114C94 131 42 127 17 153Z"
          fill="#65affc"
          opacity={0.4}
        />
      )}
      <G transform={phone ? "rotate(10 75 80)" : "rotate(13 75 80)"}>
        {phone && (
          <>
            <Rect
              x="24"
              y="4"
              width="111"
              height="154"
              rx="18"
              fill="#005de3"
              opacity={0.18}
            />
            <Rect
              x="22"
              y="2"
              width="108"
              height="152"
              rx="16"
              fill="#1f3858"
            />
            <Rect
              x="26"
              y="6"
              width="100"
              height="144"
              rx="13"
              fill="#71acff"
            />
            <Path
              d="M51 5H103L100 11Q99 14 94 14H59Q55 14 54 11Z"
              fill="#1f3858"
            />
            <Path
              d="M69 9H86"
              stroke="#89a8ca"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </>
        )}
        {workspace ? (
          <>
            <Rect
              x="44"
              y="16"
              width="84"
              height="124"
              rx="12"
              fill="#0063ff"
            />
            <Rect
              x="39"
              y="20"
              width="83"
              height="120"
              rx="12"
              fill="#50afff"
            />
          </>
        ) : (
          <>
            <Rect
              x="15"
              y="10"
              width="124"
              height="142"
              rx="17"
              fill="#4569ca"
              opacity={phone ? 0 : 0.16}
            />
            <Rect
              x="10"
              y="6"
              width="128"
              height="142"
              rx="16"
              fill="url(#glass)"
              stroke="#fff"
              opacity={phone ? 0.28 : 1}
            />
            <Path
              d="M19 34V22Q19 15 26 15H36 M112 15H123Q129 15 129 22V34 M19 121V133Q19 140 26 140H36 M112 140H122Q129 140 129 133V121"
              fill="none"
              stroke={phone ? "#ffffff" : "#0866f6"}
              strokeWidth="4"
              strokeLinecap="round"
            />
          </>
        )}
        <Path
          d={
            phone
              ? "M34 20H115Q121 20 121 27V138Q121 144 115 144H34Q28 144 28 138V26Q28 20 34 20Z"
              : "M43 24H93L119 50V126Q119 135 109 135H43Q33 135 33 125V34Q33 24 43 24Z"
          }
          fill="url(#sheet)"
        />
        {!phone && <Path d="M93 24V44Q93 50 100 50H119Z" fill="#bdd3fb" />}
        <Path
          d={
            phone
              ? "M40 34H88M40 44H96M40 54H110M40 64H107M40 74H94M40 84H106M40 95H101M40 129H107"
              : "M48 49H78M48 61H100M48 73H100M48 85H87"
          }
          fill="none"
          stroke="#9bb5e6"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <Rect
          x="52"
          y="99"
          width="49"
          height="24"
          rx="6"
          fill={documentLabel === "PDF" ? "#f21f38" : "#0759d3"}
        />
        <Text
          x="76.5"
          y="116"
          textAnchor="middle"
          fill="#fff"
          fontSize="16"
          fontWeight="bold"
        >
          {documentLabel}
        </Text>
        {!workspace && (
          <>
            <Path
              d="M14 79H135"
              stroke="#25e8fa"
              opacity={0.48}
              strokeWidth="8"
            />
            <Path d="M14 79H135" stroke="#eeffff" strokeWidth="2" />
          </>
        )}
      </G>
    </Svg>
  );
}
