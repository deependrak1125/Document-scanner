Pod::Spec.new do |s|
 s.name = 'FolioImage'
 s.version = '0.1.0'
 s.summary = 'Local document pixel processing'
 s.description = 'Folio native image enhancement and perspective correction'
 s.license = { :type => 'MIT' }
 s.author = 'Folio'
 s.homepage = 'https://example.invalid/folio'
 s.platforms = { :ios => '16.4' }
 s.source = { :git => '' }
 s.static_framework = true
 s.dependency 'ExpoModulesCore'
 s.dependency 'GoogleMLKit/Translate', '9.0.0'
 s.source_files = '**/*.{h,m,mm,swift}'
 s.frameworks = 'CoreImage', 'UIKit'
 s.swift_version = '5.9'
end
