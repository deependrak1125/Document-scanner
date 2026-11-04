package expo.modules.folioimage
import org.junit.Assert.*
import org.junit.Test
class PaperColorTest {
 @Test fun whitensGrayPaperAndKeepsColoredInk() {
  val pixels=byteArrayOf(180.toByte(),180.toByte(),180.toByte(),255.toByte(), 140.toByte(),20,20,255.toByte(), 15,30,160.toByte(),255.toByte(), 10,10,10,255.toByte())
  whitenPaper(pixels,byteArrayOf(180.toByte(),180.toByte(),180.toByte(),180.toByte()))
  fun channel(index:Int)=pixels[index].toInt() and 255
  assertEquals(255,channel(0));assertEquals(255,channel(1));assertEquals(255,channel(2))
  assertTrue(channel(4)>channel(5)*5);assertEquals(channel(5),channel(6))
  assertTrue(channel(10)>channel(8)*5)
  assertTrue(channel(12)<25);assertEquals(255,channel(15))
 }
 @Test fun doesNotTurnPaleColoredInkIntoWhite() {
  val pixels=byteArrayOf(250.toByte(),180.toByte(),180.toByte(),255.toByte())
  whitenPaper(pixels,byteArrayOf(255.toByte()))
  assertEquals(180,pixels[1].toInt() and 255)
 }
}
