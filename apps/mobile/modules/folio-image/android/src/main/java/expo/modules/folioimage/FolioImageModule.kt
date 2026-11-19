package expo.modules.folioimage

import expo.modules.kotlin.Promise
import com.google.mlkit.nl.translate.Translation
import com.google.mlkit.nl.translate.TranslatorOptions
import com.google.mlkit.common.model.DownloadConditions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import org.opencv.android.OpenCVLoader
import org.opencv.android.Utils
import org.opencv.core.*
import org.opencv.imgproc.Imgproc
import java.io.File
import java.util.UUID
import kotlin.math.*

class FolioImageModule : Module() {
 override fun definition() = ModuleDefinition {
  Name("FolioImage")
  AsyncFunction("translate") { text: String, source: String, target: String, promise: Promise ->
   require(source in listOf("en","hi") && target in listOf("en","hi") && text.length<=20000)
   val translator=Translation.getClient(TranslatorOptions.Builder().setSourceLanguage(source).setTargetLanguage(target).build())
   translator.downloadModelIfNeeded(DownloadConditions.Builder().requireWifi().build())
    .addOnSuccessListener {
      translator.translate(text).addOnSuccessListener { result -> translator.close();promise.resolve(result) }
       .addOnFailureListener { error -> translator.close();promise.reject("TRANSLATION_FAILED",error.message,error) }
    }
    .addOnFailureListener { error -> translator.close();promise.reject("MODEL_DOWNLOAD_FAILED","Connect to Wi-Fi to download the translation model, then retry.",error) }
  }

  AsyncFunction("detect") { uri: String ->
   require(OpenCVLoader.initLocal())
   val context=appContext.reactContext ?: error("No context")
   val file=File(Uri.parse(uri).path ?: error("Invalid image"))
   require(file.canonicalPath.startsWith(context.filesDir.canonicalPath+"/") || file.canonicalPath.startsWith(context.cacheDir.canonicalPath+"/"))
   val options=BitmapFactory.Options().apply{inJustDecodeBounds=true};BitmapFactory.decodeFile(file.path,options)
   options.inSampleSize=max(1,ceil(max(options.outWidth,options.outHeight)/1200.0).toInt());options.inJustDecodeBounds=false
   val bitmap=BitmapFactory.decodeFile(file.path,options) ?: error("Image decode failed")
   val src=Mat();val gray=Mat();val edges=Mat();val hierarchy=Mat();val contours=ArrayList<MatOfPoint>()
   try {
    Utils.bitmapToMat(bitmap,src);Imgproc.cvtColor(src,gray,Imgproc.COLOR_RGBA2GRAY);Imgproc.GaussianBlur(gray,gray,Size(5.0,5.0),0.0);Imgproc.Canny(gray,edges,50.0,150.0)
    Imgproc.findContours(edges,contours,hierarchy,Imgproc.RETR_LIST,Imgproc.CHAIN_APPROX_SIMPLE)
    var best:List<Point> = emptyList();var area=src.rows()*src.cols()*0.15
    for(contour in contours){val curve=MatOfPoint2f(*contour.toArray());val approx=MatOfPoint2f();try{Imgproc.approxPolyDP(curve,approx,0.02*Imgproc.arcLength(curve,true),true);val polygon=MatOfPoint(*approx.toArray());try{val size=Imgproc.contourArea(polygon);if(approx.total()==4L && Imgproc.isContourConvex(polygon) && size>area){best=approx.toList();area=size}}finally{polygon.release()}}finally{curve.release();approx.release()}}
    if(best.isEmpty()) emptyList<List<Double>>() else {
      val cx=best.sumOf{it.x}/4;val valCy=best.sumOf{it.y}/4
      val sorted=best.sortedBy{atan2(it.y-valCy,it.x-cx)};val start=sorted.indices.minBy{sorted[it].x+sorted[it].y}
      (0..3).map{val p=sorted[(start+it)%4];listOf(p.x/src.cols(),p.y/src.rows())}
    }
   } finally {bitmap.recycle();src.release();gray.release();edges.release();hierarchy.release();contours.forEach{it.release()}}
  }
  AsyncFunction("rasterize") { uri: String, index: Int ->
   val context=appContext.reactContext ?: error("No application context")
   val file=File(Uri.parse(uri).path ?: error("Invalid file"))
   require(file.canonicalPath.startsWith(context.filesDir.canonicalPath+"/") || file.canonicalPath.startsWith(context.cacheDir.canonicalPath+"/"))
   val fd=android.os.ParcelFileDescriptor.open(file,android.os.ParcelFileDescriptor.MODE_READ_ONLY)
   android.graphics.pdf.PdfRenderer(fd).use { renderer ->
    require(index in 0 until renderer.pageCount)
    renderer.openPage(index).use { page ->
     val scale=2400.0/max(page.width,page.height)
     val bitmap=Bitmap.createBitmap((page.width*scale).toInt(),(page.height*scale).toInt(),Bitmap.Config.ARGB_8888)
     try {
      bitmap.eraseColor(android.graphics.Color.WHITE)
      page.render(bitmap,null,null,android.graphics.pdf.PdfRenderer.Page.RENDER_MODE_FOR_PRINT)
      val output=File(context.cacheDir,"folio-page-${UUID.randomUUID()}.jpg")
      output.outputStream().use { bitmap.compress(Bitmap.CompressFormat.JPEG,95,it) }
      mapOf("uri" to Uri.fromFile(output).toString(),"width" to bitmap.width,"height" to bitmap.height)
     } finally { bitmap.recycle() }
    }
   }
  }
  AsyncFunction("process") { uri: String, filter: String, brightness: Double, contrast: Double, corners: List<List<Double>> ->
   require(OpenCVLoader.initLocal()) { "OpenCV could not initialize" }
   require(brightness in -1.0..1.0 && contrast in 0.25..3.0)
   val context = appContext.reactContext ?: error("No application context")
   val path = File(Uri.parse(uri).path ?: error("Invalid local image"))
   require(path.canonicalPath.startsWith(context.filesDir.canonicalPath + "/") || path.canonicalPath.startsWith(context.cacheDir.canonicalPath + "/")) { "Only app-local files may be processed" }
   val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
   BitmapFactory.decodeFile(path.path, bounds)
   // BitmapFactory rounds arbitrary sampling factors down. Use powers of two
   // so large camera images cannot exceed the processing memory budget.
   val options = BitmapFactory.Options().apply {
    inSampleSize = 1
    while (max(bounds.outWidth,bounds.outHeight) / inSampleSize > 2400) inSampleSize *= 2
   }
   val bitmap = BitmapFactory.decodeFile(path.path,options) ?: error("Cannot decode image")
   val src=Mat(); val out=Mat(); val gray=Mat(); val temp=Mat()
   try {
    Utils.bitmapToMat(bitmap,src); bitmap.recycle()
    if(corners.isNotEmpty()) {
     require(corners.size==4 && corners.all { it.size==2 && it.all { n -> n.isFinite() && n in 0.0..1.0 } }) { "Invalid corners" }
     val pts=corners.map { Point(it[0]*src.cols(),it[1]*src.rows()) }
     fun distance(a:Point,b:Point)=hypot(a.x-b.x,a.y-b.y)
     val w=max(distance(pts[0],pts[1]),distance(pts[3],pts[2])).roundToInt()
     val h=max(distance(pts[0],pts[3]),distance(pts[1],pts[2])).roundToInt()
     require(w>=32 && h>=32) { "Crop is too small" }
     val from=MatOfPoint2f(*pts.toTypedArray());val to=MatOfPoint2f(Point(0.0,0.0),Point((w-1).toDouble(),0.0),Point((w-1).toDouble(),(h-1).toDouble()),Point(0.0,(h-1).toDouble()))
     val transform=Imgproc.getPerspectiveTransform(from,to)
     try { Imgproc.warpPerspective(src,out,transform,Size(w.toDouble(),h.toDouble()));out.copyTo(src) } finally {from.release();to.release();transform.release()}
    }
    // Keep the cleanup neighborhood proportional to the page, including thumbnails.
    val paperWindow = (min(src.cols(), src.rows()) / 28).coerceIn(5, 91) or 1
    fun estimatePaper() {
     val kernel = Imgproc.getStructuringElement(
      Imgproc.MORPH_ELLIPSE, Size(paperWindow.toDouble(), paperWindow.toDouble())
     )
     try {
      Imgproc.morphologyEx(gray, temp, Imgproc.MORPH_CLOSE, kernel)
      Imgproc.GaussianBlur(temp, temp, Size(0.0, 0.0), paperWindow / 6.0)
     } finally { kernel.release() }
    }
    when(filter) {
     "clean" -> {
      // Estimate paper illumination in luminance, then apply the same gain to
      // every color channel so colored ink keeps its hue.
      Imgproc.cvtColor(src,gray,Imgproc.COLOR_RGBA2GRAY)
      estimatePaper()
      // Process one row at a time instead of duplicating the whole image
      // into Java byte arrays while OpenCV also owns multiple full-size Mats.
      val rgba=ByteArray(src.cols()*4);val background=ByteArray(src.cols())
      src.copyTo(out)
      for (row in 0 until src.rows()) {
       src.get(row,0,rgba);temp.get(row,0,background)
       whitenPaper(rgba,background);out.put(row,0,rgba)
      }
     }
     "soft" -> { Imgproc.GaussianBlur(src,out,Size(3.0,3.0),0.5) }
     "sharpen" -> { Imgproc.GaussianBlur(src,temp,Size(0.0,0.0),1.2);Core.addWeighted(src,1.7,temp,-0.7,0.0,out) }

     "bw" -> {
      Imgproc.cvtColor(src, gray, Imgproc.COLOR_RGBA2GRAY)
      estimatePaper()
      // Normalize the page lighting before thresholding local text contrast.
      Core.max(temp, Scalar(48.0), temp)
      Core.divide(gray, temp, gray, 255.0)
      Imgproc.adaptiveThreshold(gray, gray, 255.0, Imgproc.ADAPTIVE_THRESH_GAUSSIAN_C,
       Imgproc.THRESH_BINARY, paperWindow, 10.0)
      Imgproc.cvtColor(gray, out, Imgproc.COLOR_GRAY2RGBA)
     }
     "grayscale" -> {
      Imgproc.cvtColor(src, gray, Imgproc.COLOR_RGBA2GRAY)
      Imgproc.cvtColor(gray, out, Imgproc.COLOR_GRAY2RGBA)
     }
     "enhanced" -> { Imgproc.GaussianBlur(src,temp,Size(0.0,0.0),15.0);Core.divide(src,temp,out,255.0);Imgproc.GaussianBlur(out,temp,Size(0.0,0.0),1.0);Core.addWeighted(out,1.6,temp,-0.6,0.0,out) }
     "color" -> { src.convertTo(out,-1,1.2,5.0) }
     else -> src.copyTo(out)
    }
    out.convertTo(out,-1,contrast,brightness*255.0)
    val output=Bitmap.createBitmap(out.cols(),out.rows(),Bitmap.Config.ARGB_8888)
    try {
     Utils.matToBitmap(out,output)
     val file=File(context.cacheDir,"folio-${UUID.randomUUID()}.jpg")
     file.outputStream().use { require(output.compress(Bitmap.CompressFormat.JPEG,95,it)) }
     mapOf("uri" to Uri.fromFile(file).toString(),"width" to output.width,"height" to output.height)
    } finally { output.recycle() }
   } finally {src.release();out.release();gray.release();temp.release();if(!bitmap.isRecycled)bitmap.recycle()}
  }
 }
}
