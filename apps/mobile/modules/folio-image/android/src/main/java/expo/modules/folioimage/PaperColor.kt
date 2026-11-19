package expo.modules.folioimage

import kotlin.math.*

internal fun whitenPaper(rgba: ByteArray, background: ByteArray) {
 require(rgba.size == background.size * 4)
 for (pixel in background.indices) {
  val offset = pixel * 4
  val red = rgba[offset].toInt() and 255
  val green = rgba[offset + 1].toInt() and 255
  val blue = rgba[offset + 2].toInt() and 255
  val low = minOf(red, green, blue)
  val high = maxOf(red, green, blue)
  val paper = max(48, background[pixel].toInt() and 255)
  val gain = 255.0 / paper
  val isNeutral = high - low <= 12
  val isPaper = isNeutral && low * gain >= 238
  // Limit gain for colored pixels to avoid clipping one channel and shifting hue.
  val inkGain = if (isNeutral) gain else min(gain, 255.0 / high)
  for (channel in 0..2) {
   val value = rgba[offset + channel].toInt() and 255
   rgba[offset + channel] = (if (isPaper) 255 else (value * inkGain).roundToInt().coerceAtMost(255)).toByte()
  }
  rgba[offset + 3] = 255.toByte()
 }
}
