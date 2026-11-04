package expo.modules.folioimage

import kotlin.math.*

// One luminance gain across all channels preserves ink hue while lifting paper.
internal fun whitenPaper(rgba: ByteArray, background: ByteArray) {
 require(rgba.size == background.size * 4)
      for(i in background.indices){
       val gain=255.0/max(80,background[i].toInt() and 255)
       val o=i*4
       var low=255;var high=0
       for(c in 0..2){val v=min(255,((rgba[o+c].toInt() and 255)*gain).roundToInt());rgba[o+c]=v.toByte();low=min(low,v);high=max(high,v)}
       if(low>235 && high-low<16)for(c in 0..2)rgba[o+c]=255.toByte()
       rgba[o+3]=255.toByte()
      }
}
