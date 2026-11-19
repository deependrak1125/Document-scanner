/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const { withDangerousMod } = require("@expo/config-plugins");

const marker = "Folio ML Kit OCR release fix";

function patchOcrModule(projectRoot) {
  const file = path.join(
    projectRoot,
    "node_modules",
    "rn-mlkit-ocr",
    "android",
    "src",
    "main",
    "java",
    "com",
    "rnmlkitocr",
    "RnMlkitOcrModule.kt",
  );
  if (!fs.existsSync(file)) return;
  const source = fs.readFileSync(file, "utf8");
  if (source.includes("Folio ML Kit OCR image path")) return;
  const next = source
    .replace(
      "import android.net.Uri\n",
      "import android.net.Uri\nimport android.util.Log\n",
    )
    .replace(
      ".addOnSuccessListener { text ->\n            val result = convertTextToWritableMap(text)\n            promise.resolve(result)\n          }",
      ".addOnSuccessListener { text ->\n            try {\n              val result = convertTextToWritableMap(text)\n              promise.resolve(result)\n            } catch (e: Exception) {\n              Log.e(TAG, \"Failed to convert OCR result\", e)\n              promise.reject(\"ERR_OCR_RESULT\", e.message ?: \"OCR result conversion failed\", e)\n            }\n          }",
    )
    .replace(
      `      val file = File(cleanUri)\n      if (file.exists()) {\n        val bitmap = BitmapFactory.decodeFile(cleanUri)\n        if (bitmap != null) return InputImage.fromBitmap(bitmap, 0)\n      }\n      val contentUri = Uri.parse(uri)\n      InputImage.fromFilePath(context, contentUri)`,
      `      // Folio ML Kit OCR image path: avoid Exif/file URI readers on Android 15+.\n+      val file = File(cleanUri)\n+      if (!file.exists()) {\n+        Log.w(TAG, "OCR image file does not exist: $cleanUri")\n+        return null\n+      }\n+      val bitmap = BitmapFactory.decodeFile(cleanUri) ?: return null\n+      val safeBitmap = if (bitmap.config == Bitmap.Config.ARGB_8888) {\n+        bitmap\n+      } else {\n+        bitmap.copy(Bitmap.Config.ARGB_8888, false).also { bitmap.recycle() }\n+      }\n+      InputImage.fromBitmap(safeBitmap, 0)`,
    )
    .replace(
      "      e.printStackTrace()\n      null",
      "      Log.e(TAG, \"Failed to load OCR image: $uri\", e)\n      null",
    )
    .replace(
      `  companion object {\n    const val NAME = "RnMlkitOcr"\n  }`,
      `  companion object {\n    const val NAME = "RnMlkitOcr"\n    private const val TAG = "RnMlkitOcr"\n  }`,
    );
  fs.writeFileSync(file, next);
}

function patchProguard(projectRoot) {
  const file = path.join(projectRoot, "android", "app", "proguard-rules.pro");
  if (!fs.existsSync(file)) return;
  const source = fs.readFileSync(file, "utf8");
  if (source.includes(marker)) return;
  fs.appendFileSync(
    file,
    `\n# ${marker}\n-keep class com.google.mlkit.** { *; }\n-keep class com.google.android.gms.internal.mlkit_vision_common.** { *; }\n-keep class com.google.android.gms.internal.mlkit_vision_text_common.** { *; }\n-keep class com.google.android.gms.internal.mlkit_vision_text_bundled_common.** { *; }\n-keep class com.google.android.gms.internal.mlkit_common.** { *; }\n`,
  );
}

module.exports = function withMlkitOcrFix(config) {
  return withDangerousMod(config, ["android", async (config) => {
    patchOcrModule(config.modRequest.projectRoot);
    patchProguard(config.modRequest.projectRoot);
    return config;
  }]);
};
