import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme";
import { FillGradient, HomeWaves, ScanArtwork } from "./HomeArtwork";
import { FolioIllustration } from "./FolioBrand";
import { Label } from "./ui";

const features = [
  [
    "scan-outline",
    "Smart Document Scanning",
    "Capture physical documents and convert them into high-quality digital PDFs.",
    "blue",
  ],
  [
    "construct-outline",
    "Powerful PDF Tools",
    "Merge, split, compress, edit, rotate, and organize PDFs.",
    "purple",
  ],
  [
    "folder-outline",
    "Document Management",
    "Keep your important files organized and easily accessible.",
    "gold",
  ],
  [
    "cloud-upload-outline",
    "Backup & Restore",
    "Optionally back up eligible PDFs to Google Drive on Android.",
    "green",
  ],
  [
    "share-social-outline",
    "Easy Sharing",
    "Export and share your documents directly from your device.",
    "blue",
  ],
] as const;
const colors = {
  blue: ["#007af4", "#dff2ff"],
  purple: ["#8137d0", "#f0e4ff"],
  gold: ["#ab6600", "#fff1d4"],
  green: ["#008340", "#dcf8e8"],
};
type Icon = React.ComponentProps<typeof Ionicons>["name"];

export function AboutFolio({
  version,
  website,
  onScan,
  onTools,
  onDocuments,
  onPrivacy,
  onBackup,
  onWebsite,
  onRate,
  onSupport,
  onShare,
  onAppInfo,
}: {
  version?: string | null;
  website: string;
  onScan: () => void;
  onTools: () => void;
  onDocuments: () => void;
  onPrivacy: () => void;
  onBackup: () => void;
  onWebsite: () => void;
  onRate: () => void;
  onSupport: () => void;
  onShare: () => void;
  onAppInfo: () => void;
}) {
  const t = useTheme();
  const year = new Date().getFullYear();
  const surface = { backgroundColor: t.surface, borderColor: t.line };
  const featureActions = [onScan, onTools, onDocuments, onBackup, onDocuments];

  function badge(icon: Icon, tone: keyof typeof colors) {
    const [color, tint] = colors[tone];
    return (
      <View style={[styles.badge, { backgroundColor: t.dark ? t.tint : tint }]}>
        <Ionicons name={icon} size={21} color={t.dark ? t.primary : color} />
      </View>
    );
  }
  function heading(title: string) {
    return (
      <View style={styles.heading}>
        <View style={[styles.headingMark, { backgroundColor: t.primary }]} />
        <Text
          accessibilityRole="header"
          style={[styles.section, { color: t.text }]}
        >
          {title}
        </Text>
      </View>
    );
  }

  return (
    <>
      <View style={styles.hero}>
        <FillGradient colors={["#0787f4", "#003dc6"]} />
        <View style={styles.brand}>
          <View style={styles.heroIcon}>
            <Ionicons name="scan-outline" size={28} color="#fff" />
          </View>
          <View style={[styles.copy, styles.heroCopy]}>
            <Text style={styles.heroTitle}>Folio</Text>
            <Text style={styles.heroText}>
              Document Scanner &amp; PDF Editor
            </Text>
            {!!version && <Text style={styles.version}>Version {version}</Text>}
          </View>
          <View pointerEvents="none" accessible={false} style={styles.heroArt}>
            <ScanArtwork workspace />
          </View>
        </View>
        <Text style={styles.tagline}>Scan smarter. Organize better.</Text>
      </View>

      <View style={[styles.card, styles.intro, surface]}>
        <View style={styles.copy}>
          <Label size={13}>
            Folio is a modern document management application designed to make
            scanning, editing, organizing, and sharing documents effortless.
          </Label>
          <Label size={13}>
            Whether you are a student, professional, business owner, or everyday
            user, Folio helps you transform physical paperwork into digital
            documents through a simple and intuitive experience.
          </Label>
        </View>
        <View pointerEvents="none" accessible={false} style={styles.introArt}>
          <View style={{ transform: [{ scale: 0.74 }] }}>
            <FolioIllustration kind="folder" />
          </View>
        </View>
      </View>

      {heading("What You Can Do")}
      <View style={[styles.card, surface]}>
        {features.map(([icon, title, description, tone], index) => (
          <Pressable
            key={title}
            accessibilityRole="button"
            onPress={featureActions[index]}
            style={styles.feature}
          >
            {badge(icon, tone)}
            <View
              style={[
                styles.featureCopy,
                index < features.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderColor: t.line,
                },
              ]}
            >
              <View style={styles.copy}>
                <Label size={14}>{title}</Label>
                <Label muted size={12}>
                  {description}
                </Label>
              </View>
              <Ionicons name="chevron-forward" size={16} color={t.muted} />
            </View>
          </Pressable>
        ))}
      </View>

      {heading("Designed & Developed By")}
      <View style={[styles.card, styles.company, surface]}>
        {!t.dark && (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <HomeWaves fadeBottom />
          </View>
        )}
        <View style={[styles.monogram, { borderColor: t.line }]}>
          <Text style={styles.monogramText}>N</Text>
        </View>
        <View style={styles.copy}>
          <Pressable accessibilityRole="link" onPress={onWebsite}>
            <Label size={18}>NextZen IT Solution</Label>
          </Pressable>
          <Label muted size={12}>
            Founded by Deependra Kumar · Founder &amp; CEO
          </Label>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Official NextZen IT Solution website"
            onPress={onWebsite}
            style={[
              styles.website,
              { borderColor: t.line, backgroundColor: t.tint },
            ]}
          >
            <Ionicons name="globe-outline" size={16} color={t.primary} />
            <Text
              style={{
                flex: 1,
                color: t.primary,
                fontSize: 12,
                fontWeight: "800",
              }}
            >
              {website.replace(/^https:\/\//, "")}
            </Text>
            <Ionicons name="open-outline" size={16} color={t.primary} />
          </Pressable>
        </View>
      </View>

      <View style={styles.grid}>
        {(
          [
            [
              "shield-outline",
              "Privacy & Security",
              "How we handle and protect your data.",
              "blue",
              onPrivacy,
            ],
            [
              "headset-outline",
              "Help & Support",
              "Get assistance with Folio.",
              "purple",
              onSupport,
            ],
          ] as const
        ).map(([icon, title, description, tone, onPress]) => (
          <Pressable
            key={title}
            accessibilityRole="button"
            onPress={onPress}
            style={[styles.card, styles.largeTile, surface]}
          >
            <View style={styles.tileTop}>
              {badge(icon, tone)}
              <Ionicons name="chevron-forward" size={17} color={t.muted} />
            </View>
            <Label size={15}>{title}</Label>
            <Label muted size={12}>
              {description}
            </Label>
          </Pressable>
        ))}
      </View>
      <View style={styles.grid}>
        {(
          [
            ["star-outline", "Rate Us", "gold", onRate],
            ["share-social-outline", "Share App", "blue", onShare],
            ["sync-outline", "Check for Updates", "green", onRate],
            ["information-circle-outline", "App Info", "blue", onAppInfo],
          ] as const
        ).map(([icon, title, tone, onPress]) => (
          <Pressable
            key={title}
            accessibilityRole="button"
            onPress={onPress}
            style={[styles.card, styles.smallTile, surface]}
          >
            {badge(icon, tone)}
            <Text style={[styles.tileText, { color: t.text }]}>{title}</Text>
          </Pressable>
        ))}
      </View>

      <View style={[styles.footer, { borderColor: t.line }]}>
        <View style={styles.footerCredit}>
          <Text style={{ fontSize: 18 }}>🇮🇳</Text>
          <Text
            style={[styles.footerText, { color: t.text, fontWeight: "800" }]}
          >
            Designed &amp; Developed in India
          </Text>
        </View>
        <Text
          style={[
            styles.footerText,
            {
              color: t.muted,
              borderLeftWidth: 1,
              borderColor: t.line,
              paddingLeft: 9,
            },
          ]}
        >
          © {year} NextZen IT Solution.{"\n"}All rights reserved.
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: 19,
    overflow: "hidden",
    backgroundColor: "#003dc6",
    padding: 13,
    gap: 7,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 9 },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: "#ffffff28",
    alignItems: "center",
    justifyContent: "center",
  },
  heroCopy: { borderLeftWidth: 1, borderColor: "#ffffff70", paddingLeft: 8 },
  heroTitle: { color: "#fff", fontSize: 25, fontWeight: "900" },
  heroText: { color: "#f2f8ff", fontSize: 12 },
  heroArt: { width: "26%", height: 84, maxWidth: 110 },
  version: {
    alignSelf: "flex-start",
    backgroundColor: "#d6eeff",
    color: "#004bc8",
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    fontWeight: "800",
    fontSize: 11,
  },
  tagline: { color: "#fff", fontWeight: "900", fontSize: 17 },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#294e9b",
    shadowOpacity: 0.12,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  intro: { padding: 12, flexDirection: "row", alignItems: "center", gap: 5 },
  introArt: {
    flexBasis: "25%",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  copy: { flex: 1, gap: 5 },
  heading: { flexDirection: "row", alignItems: "center", gap: 8 },
  headingMark: { width: 4, height: 17, borderRadius: 3 },
  section: { fontWeight: "900", fontSize: 17, flexShrink: 1 },
  feature: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 10,
  },
  featureCopy: {
    flex: 1,
    minHeight: 47,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
  },
  badge: {
    width: 33,
    height: 33,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  company: { flexDirection: "row", alignItems: "center", gap: 10, padding: 11 },
  monogram: { width: 53, borderRightWidth: 1, marginRight: 2 },
  monogramText: {
    fontWeight: "900",
    fontStyle: "italic",
    fontSize: 42,
    color: "#0077eb",
  },
  website: {
    borderWidth: 1,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    padding: 6,
  },
  grid: { flexDirection: "row", gap: 7 },
  largeTile: { flex: 1, padding: 9, gap: 4 },
  tileTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  smallTile: {
    flex: 1,
    minHeight: 72,
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 2,
    gap: 4,
  },
  tileText: { fontSize: 11, fontWeight: "800", textAlign: "center" },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderTopWidth: 1,
    paddingVertical: 12,
    marginTop: 4,
  },
  footerCredit: { flex: 1, flexDirection: "row", alignItems: "center", gap: 4 },
  footerText: { flex: 1, fontSize: 11 },
});
