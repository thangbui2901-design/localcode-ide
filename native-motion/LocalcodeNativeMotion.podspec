Pod::Spec.new do |s|
  s.name = 'LocalcodeNativeMotion'
  s.version = '1.0.0'
  s.summary = 'Native Swift UIKit/CoreAnimation motion engine for Code With You'
  s.license = 'MIT'
  s.homepage = 'https://github.com/thangbui2901-design/localcode-ide'
  s.author = 'Code With You'
  s.source = { :git => 'https://github.com/thangbui2901-design/localcode-ide.git', :tag => s.version.to_s }
  s.source_files = 'ios/Sources/NativeMotionPlugin/**/*.{swift,h,m,c,cc,mm,cpp}'
  s.ios.deployment_target = '13.0'
  s.dependency 'Capacitor'
  s.swift_version = '5.1'
end
