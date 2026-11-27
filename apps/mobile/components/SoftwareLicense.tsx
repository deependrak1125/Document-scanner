import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme";
import { Disclosure } from "./experience";
import { FillGradient, ScanArtwork } from "./HomeArtwork";
import { Button, Label } from "./ui";

const sections: [string, string[]][] = [
  [
    "1. License Grant",
    [
      "NextZen IT Solution grants you a limited, non-exclusive, non-transferable, and revocable license to download, install, and use Folio on compatible devices for personal and lawful professional purposes, subject to this agreement.",
    ],
  ],
  [
    "2. Ownership & Intellectual Property",
    [
      "Folio is developed by Deependra Kumar, Founder & CEO of NextZen IT Solution.",
      "All proprietary application source code, branding, logos, designs, graphics, user interfaces, and software components are owned by NextZen IT Solution or its respective licensors and are protected by applicable intellectual property laws.",
      "This agreement grants permission to use the application. It does not transfer ownership of the software.",
    ],
  ],
  [
    "3. Permitted Use",
    [
      "Users are permitted to:",
      "• Scan, create, edit, and manage PDF documents.",
      "• Import, organize, export, and share personal or professional documents.",
      "• Use available document processing tools.",
      "• Back up and restore eligible documents using supported services.",
    ],
  ],
  [
    "4. Restrictions",
    [
      "Except where permitted by applicable law or third-party license terms, users must not:",
      "• Copy, modify, or redistribute the proprietary application without authorization.",
      "• Reverse engineer, decompile, or disassemble proprietary software components.",
      "• Sell, sublicense, or commercially distribute the application without permission.",
      "• Remove copyright notices or proprietary branding.",
      "• Use Folio for unlawful, fraudulent, or unauthorized activities.",
      "• Circumvent application security or licensing mechanisms.",
    ],
  ],
  [
    "5. User Documents & Content",
    [
      "Users retain their existing ownership rights over documents, photographs, and files created, scanned, imported, or edited using Folio.",
      "NextZen IT Solution does not claim ownership of user documents.",
      "Users are responsible for ensuring that they have the necessary rights and permissions to process and share their documents.",
    ],
  ],
  [
    "6. Third-Party Services",
    [
      "Folio may integrate third-party services, including Google Drive, Google AdMob, and other supported software services.",
      "These services are governed by their respective terms, privacy policies, and licensing agreements.",
    ],
  ],
  [
    "7. Open Source Software",
    [
      "Folio may include open-source libraries and third-party software components.",
      "Such components remain subject to their respective open-source licenses, copyright notices, and distribution requirements.",
      "Nothing in this agreement restricts rights granted under applicable open-source licenses.",
    ],
  ],
  [
    "8. Privacy & Security",
    [
      "Folio is designed to store documents locally by default and provide optional cloud backup functionality for eligible documents.",
      "Users are responsible for protecting their devices, managing permissions, and maintaining backups of important files.",
      "Please refer to the Folio Privacy Policy for information regarding data handling and security practices.",
    ],
  ],
  [
    "9. Updates & Availability",
    [
      "NextZen IT Solution may release updates, security improvements, bug fixes, and feature enhancements.",
      "Application features may be modified or discontinued, subject to applicable law and existing contractual obligations.",
    ],
  ],
  [
    "10. Disclaimer of Warranties",
    [
      "To the extent permitted by applicable law, Folio is provided on an “AS IS” and “AS AVAILABLE” basis without warranties of any kind, whether express or implied.",
      "NextZen IT Solution does not guarantee uninterrupted operation, complete accuracy, or compatibility with every device.",
    ],
  ],
  [
    "11. Limitation of Liability",
    [
      "To the extent permitted by applicable law, NextZen IT Solution shall not be liable for indirect, incidental, or consequential damages resulting from application use, device failure, third-party service interruptions, or document loss.",
      "Nothing in this agreement excludes liability or consumer rights that cannot lawfully be excluded.",
    ],
  ],
  [
    "12. Termination",
    [
      "This license remains effective until terminated.",
      "NextZen IT Solution may terminate the license for material violations of this agreement, subject to applicable law.",
      "Users may terminate their use of Folio by uninstalling the application.",
    ],
  ],
  [
    "13. Governing Law",
    [
      "This agreement is governed by the applicable laws of India, without limiting any mandatory consumer protection rights available under applicable local laws.",
    ],
  ],
  [
    "14. Contact Information",
    [
      "Deependra Kumar · Founder & CEO",
      "NextZen IT Solution",
      "Folio – Document Scanner & PDF Editor",
    ],
  ],
];

const sectionDesign = [
  ["ribbon-outline", "Permission to use Folio.", "#005ae3", "#dcecff"],
  [
    "layers-outline",
    "App ownership, copyright and rights.",
    "#5c20d3",
    "#efe4ff",
  ],
  [
    "checkmark-circle-outline",
    "What you can do with Folio.",
    "#008333",
    "#d9f7e4",
  ],
  ["ban-outline", "Activities that are restricted.", "#c5172d", "#ffe3e8"],
  [
    "document-text-outline",
    "Your ownership and responsibilities.",
    "#985b00",
    "#fff0d5",
  ],
  [
    "extension-puzzle-outline",
    "Use of external services, including Google Drive.",
    "#005ae3",
    "#dcecff",
  ],
  [
    "code-slash-outline",
    "Third-party libraries and licenses.",
    "#5c20d3",
    "#efe4ff",
  ],
  [
    "shield-checkmark-outline",
    "How Folio handles and protects your data.",
    "#005ae3",
    "#dcecff",
  ],
  ["cloud-upload-outline", "App updates and changes.", "#008333", "#d9f7e4"],
  ["warning-outline", "Folio is provided “as is.”", "#b44212", "#ffebdc"],
  ["scale-outline", "Limits on our responsibility.", "#bf1464", "#ffe3f0"],
  ["power-outline", "When and how the license ends.", "#005ae3", "#dcecff"],
  ["hammer-outline", "Applicable laws in India.", "#5c20d3", "#efe4ff"],
  [
    "mail-outline",
    "How to reach us about this agreement.",
    "#00768e",
    "#def3fc",
  ],
] as const;

export function SoftwareLicense({
  onWebsite,
  onPrivacy,
  onLicenses,
}: {
  onWebsite: () => void;
  onPrivacy: () => void;
  onLicenses: () => void;
}) {
  const t = useTheme();
  const year = new Date().getFullYear();
  return (
    <>
      <View style={styles.hero}>
        <FillGradient colors={["#0878f3", "#0036be"]} />
        <View style={styles.brand}>
          <View style={styles.brandIcon}>
            <Ionicons name="scan-outline" size={27} color="#fff" />
          </View>
          <View style={styles.copy}>
            <Text style={styles.title}>Folio</Text>
            <Text style={styles.subtitle}>
              Document Scanner &amp; PDF Editor
            </Text>
            <Text style={styles.eula}>Software License Agreement (EULA)</Text>
          </View>
          <View pointerEvents="none" accessible={false} style={styles.art}>
            <ScanArtwork workspace documentLabel="EULA" />
          </View>
        </View>
        <Text style={styles.subtitle}>
          Copyright © {year} NextZen IT Solution. All rights reserved.
        </Text>
      </View>
      <View
        style={[
          styles.notice,
          { backgroundColor: t.tint, borderColor: t.line },
        ]}
      >
        <Ionicons
          name="information-circle-outline"
          size={25}
          color={t.primary}
        />
        <View style={styles.copy}>
          <Label size={13}>
            Please read this agreement carefully before using Folio.
          </Label>
        </View>
      </View>
      <View style={styles.sections}>
        {sections.map(([title, paragraphs], index) => {
          const [icon, description, foreground, background] =
            sectionDesign[index];
          return (
            <Disclosure
              key={title}
              title={title}
              description={description}
              icon={icon}
              compact
              iconColors={{ foreground, background }}
            >
              {paragraphs.map((paragraph) => (
                <Label key={paragraph} muted>
                  {paragraph}
                </Label>
              ))}
              {index === 6 && (
                <Button
                  title="Open Source Licenses"
                  icon="code-slash-outline"
                  secondary
                  onPress={onLicenses}
                />
              )}
              {index === 7 && (
                <Button
                  title="Privacy Policy"
                  icon="shield-checkmark-outline"
                  secondary
                  onPress={onPrivacy}
                />
              )}
              {index === sections.length - 1 && (
                <Button
                  title="Official Website"
                  icon="open-outline"
                  secondary
                  onPress={onWebsite}
                />
              )}
            </Disclosure>
          );
        })}
      </View>
      <View
        style={[
          styles.notice,
          { backgroundColor: t.tint, borderColor: t.line },
        ]}
      >
        <Text style={{ fontSize: 20 }}>🇮🇳</Text>
        <View style={styles.copy}>
          <Label size={13}>Designed &amp; Developed in India</Label>
        </View>
        <View
          style={[
            styles.copy,
            { borderLeftWidth: 1, borderColor: t.line, paddingLeft: 8 },
          ]}
        >
          <Label muted size={12}>
            A product by NextZen IT Solution.
          </Label>
        </View>
      </View>
      <Text style={[styles.copyright, { color: t.muted }]}>
        © {year} NextZen IT Solution. All rights reserved.
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: 17,
    backgroundColor: "#0036be",
    overflow: "hidden",
    padding: 12,
    gap: 8,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandIcon: {
    width: 43,
    height: 45,
    borderRadius: 12,
    backgroundColor: "#0ea5f2",
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1, gap: 4 },
  art: { width: "23%", maxWidth: 105, height: 76 },
  title: { fontSize: 24, color: "#fff", fontWeight: "900" },
  subtitle: { fontSize: 12, color: "#f3f8ff" },
  eula: {
    alignSelf: "flex-start",
    backgroundColor: "#d6efff",
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 10,
    color: "#004ac5",
    fontSize: 11,
    fontWeight: "800",
  },
  notice: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sections: { gap: 5 },
  copyright: { textAlign: "center", paddingBottom: 12, fontSize: 12 },
});
