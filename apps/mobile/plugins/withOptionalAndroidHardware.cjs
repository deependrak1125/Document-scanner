/* eslint-disable @typescript-eslint/no-require-imports */
const { withAndroidManifest } = require("@expo/config-plugins");

module.exports = function withOptionalAndroidHardware(config) {
  return withAndroidManifest(config, (result) => {
    const manifest = result.modResults.manifest;
    const optional = [
      "android.hardware.screen.portrait",
      "android.hardware.wifi",
    ];
    manifest["uses-feature"] = [
      ...(manifest["uses-feature"] ?? []).filter(
        (entry) => !optional.includes(entry.$?.["android:name"]),
      ),
      ...optional.map((name) => ({
        $: { "android:name": name, "android:required": "false" },
      })),
    ];
    return result;
  });
};
