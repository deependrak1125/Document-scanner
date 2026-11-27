import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Disclosure } from "./experience";
import { FillGradient, ScanArtwork } from "./HomeArtwork";
import { useTheme } from "../theme";
import { Label } from "./ui";

const sections: [string, string[]][] = [
  [
    "1. Introduction",
    [
      "Welcome to Folio. We respect your privacy and are committed to protecting your personal information and documents. This Privacy Policy explains how Folio handles, stores, processes and protects your information when you use our application.",
    ],
  ],
  [
    "2. Information We Handle",
    [
      "Folio may handle the following information to provide its services:",
      "- Scanned documents, photographs and imported PDF files.",
      "- Document names, file sizes, folders and creation dates.",
      "- Application preferences and scan settings.",
      "- Google account information required for optional Google Drive integration.",
      "- Device information, advertising identifiers and diagnostic information, where applicable.",
      "Creating an account is not required to use the core document scanning and PDF editing features.",
    ],
  ],
  [
    "3. Local Document Storage",
    [
      "Your scanned documents and imported PDF files are stored in app-private storage on your device by default.",
      "You can scan, edit, organize and manage documents without connecting a cloud storage account.",
      "Documents that you export or share may be stored outside Folio's private storage.",
    ],
  ],
  [
    "4. Camera and File Access",
    [
      "Folio may request access to your device's camera, photos and files to provide the following functionality:",
      "- Scan physical documents.",
      "- Import existing images and PDF files.",
      "- Convert photographs into PDF documents.",
      "- Edit, save and export documents.",
      "You can manage or revoke these permissions through your device settings.",
    ],
  ],
  [
    "5. On-Device OCR",
    [
      "Optical Character Recognition (OCR) allows Folio to recognize and extract text from scanned documents.",
      "OCR processing takes place locally on your device. Document contents are not uploaded to external servers for text recognition.",
    ],
  ],
  [
    "6. Google Drive Backup",
    [
      "Google Drive integration is optional. You can connect your Google account to back up and restore eligible PDF documents.",
      "Regular PDF documents are backed up to the Folio/Documents folder in your Google Drive account.",
      "- Automatic backup runs while Folio is open.",
      "- Private ID scans are excluded from automatic backup.",
      "- Documents in Trash are excluded.",
      "- PDF files larger than 30 MB are excluded from automatic backup.",
      "- You can connect the same Google account on another device to restore eligible documents.",
      "Google account information and authorized Drive access are used to provide backup and restoration functionality.",
      "Folio's use and transfer of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements.",
      "Google Drive services are also subject to Google's Privacy Policy.",
      "Disconnecting Google Drive stops future authorized backup operations but does not automatically delete previously backed-up documents.",
    ],
  ],
  [
    "7. Biometric & Device Security",
    [
      "Folio provides optional application lock functionality using supported device authentication methods, such as:",
      "- Fingerprint authentication.",
      "- Facial recognition.",
      "- Device PIN, pattern or password.",
      "Authentication is handled by your device's operating system. Folio does not directly collect or store your fingerprint or facial recognition data.",
      "Application lock helps prevent unauthorized access through Folio. It does not independently encrypt each locally stored PDF file.",
    ],
  ],
  [
    "8. Advertising & Third-Party Services",
    [
      "Folio may use Google AdMob to display advertisements.",
      "Advertising services may process certain information, including device identifiers, IP addresses, advertising identifiers, ad interactions and diagnostic information, in accordance with their respective privacy policies.",
      "Document contents are not shared with advertising or analytics services.",
      "Where required by applicable laws, users will be provided with advertising consent and privacy choices.",
      "Google Privacy Policy: https://policies.google.com/privacy",
      "Google Advertising Information: https://policies.google.com/technologies/ads",
    ],
  ],
  [
    "9. Data Sharing",
    [
      "Folio does not sell your personal documents.",
      "Documents may be transferred outside your device when you explicitly use features such as cloud backup, document sharing or file export.",
      "Third-party services may process limited information necessary to provide their respective services.",
      "Information may also be disclosed where required by applicable law.",
    ],
  ],
  [
    "10. Data Retention & Deletion",
    [
      "Locally stored documents remain on your device until you delete them, clear application data or uninstall Folio.",
      "Documents moved to Trash may remain available until permanently deleted.",
      "Cloud backups remain subject to your Google Drive account settings and retention policies.",
      "Before uninstalling Folio, we recommend exporting important documents or verifying that your cloud backup has completed successfully.",
    ],
  ],
  [
    "11. Your Privacy Choices",
    [
      "You can manage your privacy by:",
      "- Enabling or disabling application lock.",
      "- Managing camera and file permissions.",
      "- Connecting or disconnecting Google Drive.",
      "- Managing advertising consent where available.",
      "- Deleting or exporting your documents.",
      "- Permanently deleting files from Trash.",
      "- Managing cloud backups through Google Drive.",
    ],
  ],
  [
    "12. Data Security",
    [
      "Folio uses app-private storage and supported operating system security mechanisms to help protect your documents.",
      "Although reasonable security measures are used, no storage system or method of electronic transmission can guarantee absolute security.",
      "Users should protect their devices with a secure screen lock and maintain backups of important documents.",
    ],
  ],
  [
    "13. Children's Privacy",
    [
      "Folio is a general-purpose productivity application and is not specifically directed toward children under the age of 13.",
      "We do not knowingly collect personal information directly from children in violation of applicable privacy laws.",
      "Parents or guardians may contact us regarding privacy concerns.",
    ],
  ],
  [
    "14. International Data Processing",
    [
      "Optional third-party services, including Google Drive and advertising providers, may process information in countries other than your country of residence, subject to their respective privacy policies and applicable laws.",
    ],
  ],
  [
    "15. Your Privacy Rights",
    [
      "Depending on your location and applicable laws, you may have rights to access, correct, delete or restrict the processing of your personal information, withdraw consent or raise a privacy-related complaint.",
      "You may contact us to exercise applicable privacy rights.",
    ],
  ],
  [
    "16. Changes to This Privacy Policy",
    [
      "We may update this Privacy Policy to reflect changes in application functionality, security practices, third-party services or legal requirements.",
      "The updated policy will be made available through the application or our official website.",
    ],
  ],
  [
    "17. Contact Us",
    [
      "If you have any questions regarding privacy, security or data protection, please contact us.",
      "Developer: Nextzen IT Solution",
      "Application: Folio – Document Scanner & PDF Editor",
      "Website: https://nextzenitsolution.in/",
      "Contact email: info@nextzenitsolution.in",
    ],
  ],
];

const icons = [
  "information-circle-outline",
  "document-text-outline",
  "folder-outline",
  "camera-outline",
  "scan-outline",
  "cloud-upload-outline",
  "finger-print-outline",
  "megaphone-outline",
  "share-social-outline",
  "trash-outline",
  "options-outline",
  "lock-closed-outline",
  "people-outline",
  "globe-outline",
  "shield-outline",
  "refresh-outline",
  "mail-outline",
] as const;

const overview = [
  [0, "An overview of our privacy practices."],
  [1, "What data we process and why."],
  [2, "How your documents are stored on your device."],
  [3, "Permissions we use and their purpose."],
  [4, "Text recognition works locally on your device."],
  [5, "Optional backup and restore using your Google account."],
  [6, "Protect Folio with device authentication.", "Biometric & App Lock"],
  [8, "When and with whom data may be shared."],
  [11, "How Folio helps protect your information."],
  [9, "How to delete your data and what happens next.", "Data Deletion"],
] as const;

const principles = [
  [
    "lock-closed-outline",
    "Private by Default",
    "Files stay on this device",
    "#0066ed",
    "#e5efff",
  ],
  [
    "shield-checkmark-outline",
    "Secure & Controlled",
    "Manage your own data",
    "#008b46",
    "#e3f7eb",
  ],
  [
    "cloud-outline",
    "Optional Backup",
    "Connect Google Drive",
    "#0874ea",
    "#e6f4ff",
  ],
] as const;

export function PrivacyPolicy({
  onReadFull,
  full = false,
}: {
  onReadFull?: () => void;
  full?: boolean;
}) {
  const t = useTheme();
  return (
    <>
      <View style={styles.hero}>
        <FillGradient colors={["#039ff0", "#0543cf"]} />
        <View style={styles.heroRow}>
          <View style={styles.badge}>
            <Ionicons name="shield-checkmark" size={32} color="#fff" />
          </View>
          <View style={styles.copy}>
            <Text style={styles.title}>Your Privacy in Folio</Text>
            <Text style={styles.subtitle}>
              Document Scanner &amp; PDF Editor
            </Text>
            <Text style={styles.subtitle}>
              Developed by NextZen IT Solution
            </Text>
          </View>
          <View style={styles.art} pointerEvents="none" accessible={false}>
            <ScanArtwork workspace />
          </View>
        </View>
        <View style={styles.dateBadge}>
          <Ionicons name="calendar-outline" size={15} color="#0049c4" />
          <Text style={styles.date}>Effective November 27, 2026</Text>
        </View>
      </View>
      {!full && (
        <View
          style={[
            styles.principles,
            { backgroundColor: t.surface, borderColor: t.line },
          ]}
        >
          {principles.map(([icon, title, description, color, tint], index) => (
            <View
              key={title}
              style={[
                styles.principle,
                index > 0 && { borderLeftWidth: 1, borderColor: t.line },
              ]}
            >
              <View
                style={[
                  styles.principleIcon,
                  { backgroundColor: t.dark ? t.tint : tint },
                ]}
              >
                <Ionicons
                  name={icon}
                  size={21}
                  color={t.dark ? t.primary : color}
                />
              </View>
              <Text style={[styles.principleTitle, { color: t.text }]}>
                {title}
              </Text>
              <Text style={[styles.principleDescription, { color: t.muted }]}>
                {description}
              </Text>
            </View>
          ))}
        </View>
      )}
      <View style={styles.heading}>
        <Label size={19}>Privacy Policy</Label>
        {!full && (
          <Pressable
            accessibilityRole="button"
            onPress={onReadFull}
            style={[styles.fullLink, { borderColor: t.primary }]}
          >
            <Ionicons name="book-outline" size={17} color={t.primary} />
            <Text style={{ color: t.primary, fontWeight: "800", fontSize: 12 }}>
              Read Full Policy
            </Text>
          </Pressable>
        )}
      </View>
      {(full
        ? sections.map((_, index) => ({ index }))
        : overview.map(([index, description, heading]) => ({
            index,
            description,
            heading,
          }))
      ).map(
        ({
          index,
          description,
          heading,
        }: {
          index: number;
          description?: string;
          heading?: string;
        }) => {
          const [title, lines] = sections[index];
          return (
            <Disclosure
              key={title}
              title={full ? title : (heading ?? title.replace(/^\d+\. /, ""))}
              description={description}
              icon={icons[index]}
              initiallyOpen={full}
            >
              {lines.map((line) => {
                const url = line.match(/https:\/\/\S+$/)?.[0];
                const email = line.startsWith("Contact email: ")
                  ? line.slice("Contact email: ".length)
                  : undefined;
                const target = url ?? (email ? `mailto:${email}` : undefined);
                return target ? (
                  <Pressable
                    key={line}
                    accessibilityRole="link"
                    style={[styles.link, { backgroundColor: t.tint }]}
                    onPress={() =>
                      void Linking.openURL(target).catch(() =>
                        Alert.alert("Could not open link", "Please try again."),
                      )
                    }
                  >
                    <Ionicons
                      name={email ? "mail-outline" : "open-outline"}
                      size={17}
                      color={t.primary}
                    />
                    <Text
                      style={{ flex: 1, color: t.primary, fontWeight: "700" }}
                    >
                      {email ??
                        line
                          .slice(0, line.indexOf("https://"))
                          .replace(/:\s*$/, "")}
                    </Text>
                  </Pressable>
                ) : (
                  <Label key={line} muted>
                    {line.startsWith("- ") ? `• ${line.slice(2)}` : line}
                  </Label>
                );
              })}
            </Disclosure>
          );
        },
      )}
      {full && (
        <View style={[styles.footer, { backgroundColor: t.tint }]}>
          <Ionicons name="lock-closed-outline" size={20} color={t.primary} />
          <View style={styles.copy}>
            <Label size={15}>Your documents. Your control. Your privacy.</Label>
            <Label muted size={13}>
              Folio is designed to help you manage your documents while
              maintaining control over your personal information.
            </Label>
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  hero: {
    padding: 13,
    borderRadius: 19,
    overflow: "hidden",
    backgroundColor: "#0543cf",
    gap: 9,
  },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: {
    backgroundColor: "#ffffff30",
    width: 43,
    height: 48,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  art: { width: "22%", maxWidth: 95, height: 69 },
  copy: { flex: 1, gap: 4 },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  subtitle: { color: "#edf4ff", fontSize: 12 },
  dateBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#dcf0ff",
    borderRadius: 15,
  },
  date: { color: "#0049c4", fontSize: 11, fontWeight: "800" },
  principles: {
    flexDirection: "row",
    borderRadius: 17,
    borderWidth: 1,
    paddingVertical: 10,
  },
  principle: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 4,
    paddingHorizontal: 4,
  },
  principleIcon: {
    width: 33,
    height: 33,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  principleTitle: { fontWeight: "800", fontSize: 11, textAlign: "center" },
  principleDescription: { fontSize: 11, textAlign: "center" },
  heading: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 6,
  },
  fullLink: {
    flexDirection: "row",
    gap: 5,
    minHeight: 35,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  footer: {
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
});
