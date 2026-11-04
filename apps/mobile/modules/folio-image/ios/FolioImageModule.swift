import ExpoModulesCore
import CoreImage
import UIKit
import ImageIO
import Vision
import MLKitTranslate
import MLKitCommon

public class FolioImageModule: Module {
 private let queue = DispatchQueue(label: "app.folio.image", qos: .userInitiated)
 public func definition() -> ModuleDefinition {
  Name("FolioImage")
  AsyncFunction("translate") { (text: String, source: String, target: String, promise: Promise) in
   guard ["en","hi"].contains(source),["en","hi"].contains(target),text.count<=20000 else {promise.reject("INVALID_TRANSLATION","Choose English or Hindi and shorter text.");return}
   let translator=Translator.translator(options:TranslatorOptions(sourceLanguage:source == "hi" ? .hindi : .english,targetLanguage:target == "hi" ? .hindi : .english))
   translator.downloadModelIfNeeded(with:ModelDownloadConditions(allowsCellularAccess:false,allowsBackgroundDownloading:true)) { error in
    if let error=error {promise.reject("MODEL_DOWNLOAD_FAILED","Connect to Wi-Fi to download the translation model: \(error.localizedDescription)");return}
    translator.translate(text) { result,error in
     if let error=error {promise.reject("TRANSLATION_FAILED",error.localizedDescription)} else if let result=result {promise.resolve(result)} else {promise.reject("TRANSLATION_FAILED","No translated text returned.")}
    }
   }
  }

  AsyncFunction("detect") { (uri:String) -> [[Double]] in
   guard let url=URL(string:uri),url.isFileURL,url.standardizedFileURL.path.hasPrefix(NSHomeDirectory()+"/") else {throw NSError(domain:"Folio",code:8)}
   let request=VNDetectRectanglesRequest();request.maximumObservations=1;request.minimumConfidence=0.65;request.minimumSize=0.2;request.minimumAspectRatio=0.2
   try VNImageRequestHandler(url:url).perform([request])
   guard let rectangle=request.results?.first else {return []}
   return [rectangle.topLeft,rectangle.topRight,rectangle.bottomRight,rectangle.bottomLeft].map{[Double($0.x),Double(1-$0.y)]}
  }.runOnQueue(queue)
  AsyncFunction("rasterize") { (uri: String, index: Int) -> [String: Any] in
   guard let url=URL(string:uri),url.isFileURL,url.standardizedFileURL.path.hasPrefix(NSHomeDirectory()+"/"),let pdf=CGPDFDocument(url as CFURL),let page=pdf.page(at:index+1) else {throw NSError(domain:"Folio",code:5)}
   let bounds=page.getBoxRect(.mediaBox),scale=2400/max(bounds.width,bounds.height)
   let width=Int(bounds.width*scale),height=Int(bounds.height*scale)
   guard let context=CGContext(data:nil,width:width,height:height,bitsPerComponent:8,bytesPerRow:0,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue) else {throw NSError(domain:"Folio",code:6)}
   context.setFillColor(UIColor.white.cgColor);context.fill(CGRect(x:0,y:0,width:width,height:height))
   context.concatenate(page.getDrawingTransform(.mediaBox,rect:CGRect(x:0,y:0,width:width,height:height),rotate:0,preserveAspectRatio:true));context.drawPDFPage(page)
   guard let cg=context.makeImage(),let bytes=UIImage(cgImage:cg).jpegData(compressionQuality:0.95) else {throw NSError(domain:"Folio",code:7)}
   let output=FileManager.default.temporaryDirectory.appendingPathComponent("folio-page-\(UUID().uuidString).jpg")
   try bytes.write(to:output,options:.atomic)
   return ["uri":output.absoluteString,"width":width,"height":height]
  }.runOnQueue(queue)
  AsyncFunction("process") { (uri: String, filter: String, brightness: Double, contrast: Double, corners: [[Double]]) -> [String: Any] in
   guard let url = URL(string: uri), url.isFileURL,
    url.standardizedFileURL.path.hasPrefix(NSHomeDirectory() + "/"),
    let data = NSData(contentsOf: url), let source = CGImageSourceCreateWithData(data, nil) else { throw NSError(domain:"Folio",code:1,userInfo:[NSLocalizedDescriptionKey:"Cannot open local image"]) }
   guard let cg = CGImageSourceCreateThumbnailAtIndex(source, 0, [kCGImageSourceCreateThumbnailFromImageAlways:true,kCGImageSourceThumbnailMaxPixelSize:3200,kCGImageSourceCreateThumbnailWithTransform:true] as CFDictionary) else { throw NSError(domain:"Folio",code:2) }
   var image = CIImage(cgImage:cg)
   if !corners.isEmpty {
    guard corners.count == 4 && corners.allSatisfy({$0.count == 2 && $0.allSatisfy({$0.isFinite && $0 >= 0 && $0 <= 1})}) else { throw NSError(domain:"Folio",code:3) }
    let w=image.extent.width,h=image.extent.height
    let keys=["inputTopLeft","inputTopRight","inputBottomRight","inputBottomLeft"]
    var values:[String:Any]=[:]
    for i in 0..<4 {values[keys[i]]=CIVector(x:corners[i][0]*w,y:(1-corners[i][1])*h)}
    image=image.applyingFilter("CIPerspectiveCorrection",parameters:values)
   }
   if filter == "clean" {
    let background=image.applyingFilter("CIColorControls",parameters:[kCIInputSaturationKey:0]).clampedToExtent().applyingFilter("CIMorphologyMaximum",parameters:[kCIInputRadiusKey:15]).applyingFilter("CIGaussianBlur",parameters:[kCIInputRadiusKey:21]).cropped(to:image.extent)
    guard let kernel=CIColorKernel(source:"kernel vec4 cleanPaper(__sample source, __sample background) { float gain = 1.0 / max(0.314, background.r); vec3 rgb = min(vec3(1.0), source.rgb * gain); float lo = min(rgb.r, min(rgb.g, rgb.b)); float hi = max(rgb.r, max(rgb.g, rgb.b)); if (lo > 0.922 && hi-lo < 0.063) rgb = vec3(1.0); return vec4(rgb, 1.0); }"),let cleaned=kernel.apply(extent:image.extent,arguments:[image,background]) else {throw NSError(domain:"Folio",code:9)}
    image=cleaned
   }
   if filter == "soft" {image=image.clampedToExtent().applyingFilter("CIGaussianBlur",parameters:[kCIInputRadiusKey:0.5]).cropped(to:image.extent)}
   if filter == "sharpen" {image=image.applyingFilter("CISharpenLuminance",parameters:[kCIInputSharpnessKey:0.7])}
   if filter == "grayscale" || filter == "bw" {image=image.applyingFilter("CIColorControls",parameters:[kCIInputSaturationKey:0])}
   if filter == "bw" {image=image.applyingFilter("CIColorThreshold",parameters:["inputThreshold":0.55])}
   if filter == "enhanced" {image=image.applyingFilter("CIHighlightShadowAdjust",parameters:["inputShadowAmount":0.7,"inputHighlightAmount":0.8]).applyingFilter("CISharpenLuminance",parameters:[kCIInputSharpnessKey:0.7])}
   if filter == "color" {image=image.applyingFilter("CIColorControls",parameters:[kCIInputSaturationKey:1.25,kCIInputContrastKey:1.15])}
   image=image.applyingFilter("CIColorControls",parameters:[kCIInputBrightnessKey:min(1,max(-1,brightness)),kCIInputContrastKey:min(3,max(0.25,contrast))])
   let context=CIContext(options:[.cacheIntermediates:false])
   guard let result=context.createCGImage(image,from:image.extent),let jpeg=UIImage(cgImage:result).jpegData(compressionQuality:0.95) else {throw NSError(domain:"Folio",code:4)}
   let output=FileManager.default.temporaryDirectory.appendingPathComponent("folio-\(UUID().uuidString).jpg")
   try jpeg.write(to:output,options:.atomic)
   return ["uri":output.absoluteString,"width":result.width,"height":result.height]
  }.runOnQueue(queue)
 }
}
