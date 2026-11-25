import Foundation
import UIKit
import QuartzCore
import Capacitor

/// Apple UIKit + CoreAnimation (Metal Render Server) Native Motion Engine
/// Chạy hoàn toàn ở tầng hệ điều hành iOS/iPadOS (tách biệt khỏi JS/React/WebKit)
/// để mang lại chuyển cảnh khóa cứng 60/120Hz ProMotion cho toàn bộ app Code With You.
@objc(NativeMotionPlugin)
public class NativeMotionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeMotionPlugin"
    public let jsName = "NativeMotion"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "captureSnapshot", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "revealThemeRipple", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "playPageTransition", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "playWelcomeMagicMove", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "playConfettiBurst", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "syncBackdropColor", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearOverlay", returnType: CAPPluginReturnPromise)
    ]

    private var activeSnapshotView: UIView?
    private var activeDecorationViews: [UIView] = []
    private var activeDecorationLayers: [CALayer] = []
    private var transitionCounter: Int = 0

    // MARK: - Helpers

    private func colorFromHex(_ hex: String?, fallback: UIColor) -> UIColor {
        guard let raw = hex?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else {
            return fallback
        }
        var cleaned = raw
        if cleaned.hasPrefix("#") {
            cleaned.removeFirst()
        }
        if cleaned.count == 3 {
            cleaned = cleaned.map { "\($0)\($0)" }.joined()
        }
        guard cleaned.count == 6, let value = UInt64(cleaned, radix: 16) else {
            return fallback
        }
        let r = CGFloat((value & 0xFF0000) >> 16) / 255.0
        let g = CGFloat((value & 0x00FF00) >> 8) / 255.0
        let b = CGFloat(value & 0x0000FF) / 255.0
        return UIColor(red: r, green: g, blue: b, alpha: 1.0)
    }

    private func cleanupOverlaysOnMain() {
        if let webView = self.bridge?.webView {
            webView.layer.removeAllAnimations()
            webView.transform = .identity
            webView.layer.shadowOpacity = 0.0
        }

        activeSnapshotView?.layer.removeAllAnimations()
        activeSnapshotView?.layer.mask?.removeAllAnimations()
        activeSnapshotView?.removeFromSuperview()
        activeSnapshotView = nil

        for view in activeDecorationViews {
            view.layer.removeAllAnimations()
            view.removeFromSuperview()
        }
        activeDecorationViews.removeAll()

        for layer in activeDecorationLayers {
            layer.removeAllAnimations()
            layer.removeFromSuperlayer()
        }
        activeDecorationLayers.removeAll()
    }

    /// Tạo đường dẫn compound evenOdd (khung chữ nhật ngoài + hình tròn trong) với số đỉnh cố định
    /// để CoreAnimation nội suy 120Hz hoàn hảo không biến dạng.
    private func makeEvenOddCutoutPath(bounds: CGRect, center: CGPoint, radius: CGFloat) -> CGPath {
        let safeR = max(0.5, radius)
        let path = UIBezierPath(rect: bounds)
        let ovalRect = CGRect(
            x: center.x - safeR,
            y: center.y - safeR,
            width: safeR * 2.0,
            height: safeR * 2.0
        )
        path.append(UIBezierPath(ovalIn: ovalRect))
        return path.cgPath
    }

    // MARK: - 1. Capture Snapshot (Metal Framebuffer Snapshot ~1ms)

    @objc func captureSnapshot(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self,
                  let webView = self.bridge?.webView,
                  let container = webView.superview else {
                call.resolve(["captured": false])
                return
            }

            self.transitionCounter += 1
            self.cleanupOverlaysOnMain()

            guard let snapshot = webView.snapshotView(afterScreenUpdates: false) else {
                call.resolve(["captured": false])
                return
            }

            snapshot.frame = webView.frame
            snapshot.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            snapshot.isUserInteractionEnabled = false
            container.addSubview(snapshot)
            self.activeSnapshotView = snapshot

            call.resolve(["captured": true])
        }
    }

    // MARK: - 2. Theme Switch Circular Ripple (Telegram iOS / Apple CoreAnimation Metal 120Hz)

    @objc func revealThemeRipple(_ call: CAPPluginCall) {
        let rawX = call.getDouble("x")
        let rawY = call.getDouble("y")
        let duration = max(0.24, min(1.0, call.getDouble("duration") ?? 0.54))
        let accentHex = call.getString("accentHex") ?? "#38BDF8"

        DispatchQueue.main.async { [weak self] in
            guard let self = self,
                  let webView = self.bridge?.webView,
                  let container = webView.superview,
                  let snapshot = self.activeSnapshotView else {
                call.resolve(["animated": false])
                return
            }

            let token = self.transitionCounter
            let bounds = snapshot.bounds
            let center = CGPoint(
                x: rawX.map { CGFloat($0) } ?? bounds.midX,
                y: rawY.map { CGFloat($0) } ?? bounds.midY
            )

            let dx = max(center.x, bounds.width - center.x)
            let dy = max(center.y, bounds.height - center.y)
            let endRadius = hypot(dx, dy) + 12.0

            let startPath = self.makeEvenOddCutoutPath(bounds: bounds, center: center, radius: 1.0)
            let endPath = self.makeEvenOddCutoutPath(bounds: bounds, center: center, radius: endRadius)

            let maskLayer = CAShapeLayer()
            maskLayer.frame = bounds
            maskLayer.fillRule = .evenOdd
            maskLayer.path = endPath
            snapshot.layer.mask = maskLayer

            // Đường viền ánh sáng mảnh phát quang chạy khóa khớp 1:1 theo mép hình tròn
            let accentColor = self.colorFromHex(accentHex, fallback: UIColor.systemBlue)
            let ringLayer = CAShapeLayer()
            ringLayer.frame = snapshot.frame
            ringLayer.fillColor = UIColor.clear.cgColor
            ringLayer.strokeColor = accentColor.cgColor
            ringLayer.lineWidth = 2.0
            ringLayer.shadowColor = accentColor.cgColor
            ringLayer.shadowOpacity = 0.72
            ringLayer.shadowRadius = 8.0
            ringLayer.shadowOffset = .zero
            ringLayer.opacity = 0.0

            let ringStartPath = UIBezierPath(
                ovalIn: CGRect(x: center.x - 1.0, y: center.y - 1.0, width: 2.0, height: 2.0)
            ).cgPath
            let ringEndPath = UIBezierPath(
                ovalIn: CGRect(
                    x: center.x - endRadius,
                    y: center.y - endRadius,
                    width: endRadius * 2.0,
                    height: endRadius * 2.0
                )
            ).cgPath
            ringLayer.path = ringEndPath
            container.layer.addSublayer(ringLayer)
            self.activeDecorationLayers.append(ringLayer)

            let timing = CAMediaTimingFunction(controlPoints: 0.32, 0.72, 0.0, 1.0)

            CATransaction.begin()
            CATransaction.setCompletionBlock { [weak self] in
                guard let self = self, self.transitionCounter == token else {
                    call.resolve(["animated": false])
                    return
                }
                self.cleanupOverlaysOnMain()
                call.resolve(["animated": true])
            }

            let cutoutAnim = CABasicAnimation(keyPath: "path")
            cutoutAnim.fromValue = startPath
            cutoutAnim.toValue = endPath
            cutoutAnim.duration = duration
            cutoutAnim.timingFunction = timing
            cutoutAnim.fillMode = .forwards
            cutoutAnim.isRemovedOnCompletion = false
            maskLayer.add(cutoutAnim, forKey: "themeRippleCutout")

            let ringPathAnim = CABasicAnimation(keyPath: "path")
            ringPathAnim.fromValue = ringStartPath
            ringPathAnim.toValue = ringEndPath
            ringPathAnim.duration = duration
            ringPathAnim.timingFunction = timing

            let ringOpacityAnim = CAKeyframeAnimation(keyPath: "opacity")
            ringOpacityAnim.values = [0.88, 0.65, 0.0]
            ringOpacityAnim.keyTimes = [0.0, 0.45, 1.0]
            ringOpacityAnim.duration = duration
            ringOpacityAnim.timingFunction = CAMediaTimingFunction(name: .easeOut)

            let ringGroup = CAAnimationGroup()
            ringGroup.animations = [ringPathAnim, ringOpacityAnim]
            ringGroup.duration = duration
            ringGroup.fillMode = .forwards
            ringGroup.isRemovedOnCompletion = false
            ringLayer.add(ringGroup, forKey: "themeRippleRing")

            CATransaction.commit()
        }
    }

    // MARK: - 3. iOS Native UINavigationController Parallax Push / Pop (Home <-> Editor)

    @objc func playPageTransition(_ call: CAPPluginCall) {
        let direction = call.getString("direction") ?? "push"
        let duration = max(0.24, min(0.75, call.getDouble("duration") ?? 0.42))

        DispatchQueue.main.async { [weak self] in
            guard let self = self,
                  let webView = self.bridge?.webView,
                  let container = webView.superview,
                  let snapshot = self.activeSnapshotView else {
                call.resolve(["animated": false])
                return
            }

            let token = self.transitionCounter
            let width = webView.bounds.width
            let isPush = direction != "pop"

            // Lớp scrim tối nhẹ tạo chiều sâu parallax chuẩn iOS Settings / Files
            let scrim = UIView(frame: webView.frame)
            scrim.backgroundColor = UIColor.black
            scrim.isUserInteractionEnabled = false
            self.activeDecorationViews.append(scrim)

            if isPush {
                // PUSH (Home -> Editor): Snapshot cũ trượt parallax sang trái & tối nhẹ; WebView mới trượt từ phải vào
                container.insertSubview(snapshot, belowSubview: webView)
                scrim.alpha = 0.0
                container.insertSubview(scrim, aboveSubview: snapshot)

                webView.transform = CGAffineTransform(translationX: width, y: 0)
                webView.layer.shadowColor = UIColor.black.cgColor
                webView.layer.shadowOpacity = 0.24
                webView.layer.shadowRadius = 18.0
                webView.layer.shadowOffset = CGSize(width: -4, height: 0)

                UIView.animate(
                    withDuration: duration,
                    delay: 0,
                    usingSpringWithDamping: 0.95,
                    initialSpringVelocity: 0.35,
                    options: [.curveEaseOut, .allowUserInteraction],
                    animations: {
                        webView.transform = .identity
                        snapshot.transform = CGAffineTransform(translationX: -width * 0.28, y: 0)
                        scrim.alpha = 0.22
                    },
                    completion: { [weak self] _ in
                        webView.transform = .identity
                        webView.layer.shadowOpacity = 0.0
                        guard let self = self, self.transitionCounter == token else {
                            call.resolve(["animated": false])
                            return
                        }
                        self.cleanupOverlaysOnMain()
                        call.resolve(["animated": true])
                    }
                )
            } else {
                // POP (Editor -> Home): Snapshot Editor nằm trên có bóng cạnh trượt phải rời màn hình; Home parallax nhẹ từ trái ra
                scrim.alpha = 0.22
                container.insertSubview(scrim, aboveSubview: webView)
                container.bringSubviewToFront(snapshot)

                snapshot.layer.shadowColor = UIColor.black.cgColor
                snapshot.layer.shadowOpacity = 0.26
                snapshot.layer.shadowRadius = 20.0
                snapshot.layer.shadowOffset = CGSize(width: -5, height: 0)

                webView.transform = CGAffineTransform(translationX: -width * 0.24, y: 0)

                UIView.animate(
                    withDuration: duration,
                    delay: 0,
                    usingSpringWithDamping: 0.95,
                    initialSpringVelocity: 0.35,
                    options: [.curveEaseOut, .allowUserInteraction],
                    animations: {
                        snapshot.transform = CGAffineTransform(translationX: width, y: 0)
                        webView.transform = .identity
                        scrim.alpha = 0.0
                    },
                    completion: { [weak self] _ in
                        webView.transform = .identity
                        guard let self = self, self.transitionCounter == token else {
                            call.resolve(["animated": false])
                            return
                        }
                        self.cleanupOverlaysOnMain()
                        call.resolve(["animated": true])
                    }
                )
            }
        }
    }

    // MARK: - 4. Welcome -> Home Native Magic Move (Retina Logo Flight + Dual Metal Portal Rings)

    @objc func playWelcomeMagicMove(_ call: CAPPluginCall) {
        let srcX = CGFloat(call.getDouble("srcX") ?? 0)
        let srcY = CGFloat(call.getDouble("srcY") ?? 0)
        let srcW = CGFloat(call.getDouble("srcW") ?? 128)
        let srcH = CGFloat(call.getDouble("srcH") ?? 128)
        let dstX = CGFloat(call.getDouble("dstX") ?? 56)
        let dstY = CGFloat(call.getDouble("dstY") ?? 56)
        let dstW = CGFloat(call.getDouble("dstW") ?? 28)
        let dstH = CGFloat(call.getDouble("dstH") ?? 28)
        let bgHex = call.getString("bgHex") ?? "#080C18"
        let accentHex = call.getString("accentHex") ?? "#3B82F6"
        let duration = max(0.35, min(0.95, call.getDouble("duration") ?? 0.66))

        DispatchQueue.main.async { [weak self] in
            guard let self = self,
                  let webView = self.bridge?.webView,
                  let container = webView.superview else {
                call.resolve(["animated": false])
                return
            }

            self.transitionCounter += 1
            let token = self.transitionCounter
            self.cleanupOverlaysOnMain()

            let srcRect = CGRect(x: srcX, y: srcY, width: max(16, srcW), height: max(16, srcH))
            let dstCenter = CGPoint(x: dstX + dstW / 2.0, y: dstY + dstH / 2.0)
            let srcCenter = CGPoint(x: srcRect.midX, y: srcRect.midY)

            // Chụp nguyên logo vuông bo góc ở độ phân giải Retina trực tiếp từ Metal framebuffer
            let logoSnap = webView.resizableSnapshotView(
                from: srcRect,
                afterScreenUpdates: false,
                withCapInsets: .zero
            )

            // Lớp màn nền mờ dần mượt mà
            let curtain = UIView(frame: webView.frame)
            curtain.backgroundColor = self.colorFromHex(bgHex, fallback: UIColor(red: 8/255, green: 12/255, blue: 24/255, alpha: 1))
            curtain.isUserInteractionEnabled = false
            container.addSubview(curtain)
            self.activeDecorationViews.append(curtain)

            // Hai vòng sóng ánh sáng đồng tâm bằng CAShapeLayer Metal
            let accent = self.colorFromHex(accentHex, fallback: UIColor.systemBlue)
            for idx in 0..<2 {
                let ring = CAShapeLayer()
                ring.frame = webView.frame
                ring.fillColor = UIColor.clear.cgColor
                ring.strokeColor = idx == 0 ? accent.cgColor : accent.withAlphaComponent(0.6).cgColor
                ring.lineWidth = idx == 0 ? 2.2 : 1.5
                if idx == 0 {
                    ring.shadowColor = accent.cgColor
                    ring.shadowOpacity = 0.65
                    ring.shadowRadius = 12.0
                    ring.shadowOffset = .zero
                }
                ring.opacity = 0.0

                let startR = max(srcW, srcH) * (idx == 0 ? 0.38 : 0.30)
                let endR = max(webView.bounds.width, webView.bounds.height) * (idx == 0 ? 0.62 : 0.78)
                let p0 = UIBezierPath(ovalIn: CGRect(x: srcCenter.x - startR, y: srcCenter.y - startR, width: startR * 2, height: startR * 2)).cgPath
                let p1 = UIBezierPath(ovalIn: CGRect(x: srcCenter.x - endR, y: srcCenter.y - endR, width: endR * 2, height: endR * 2)).cgPath
                ring.path = p1
                container.layer.addSublayer(ring)
                self.activeDecorationLayers.append(ring)

                let delay = idx == 0 ? 0.0 : 0.055
                let ringDur = duration + (idx == 0 ? 0.04 : 0.14)
                let timing = CAMediaTimingFunction(controlPoints: 0.22, 1.0, 0.36, 1.0)

                let pAnim = CABasicAnimation(keyPath: "path")
                pAnim.fromValue = p0
                pAnim.toValue = p1
                pAnim.duration = ringDur
                pAnim.timingFunction = timing

                let oAnim = CAKeyframeAnimation(keyPath: "opacity")
                oAnim.values = [idx == 0 ? 0.85 : 0.55, idx == 0 ? 0.42 : 0.24, 0.0]
                oAnim.keyTimes = [0.0, 0.48, 1.0]
                oAnim.duration = ringDur

                let group = CAAnimationGroup()
                group.animations = [pAnim, oAnim]
                group.duration = ringDur
                group.beginTime = CACurrentMediaTime() + delay
                group.fillMode = .forwards
                group.isRemovedOnCompletion = false
                ring.add(group, forKey: "welcomePortalRing_\(idx)")
            }

            if let logoView = logoSnap {
                logoView.frame = CGRect(
                    x: webView.frame.origin.x + srcRect.origin.x,
                    y: webView.frame.origin.y + srcRect.origin.y,
                    width: srcRect.width,
                    height: srcRect.height
                )
                logoView.isUserInteractionEnabled = false
                container.addSubview(logoView)
                self.activeDecorationViews.append(logoView)

                let targetCenterInContainer = CGPoint(
                    x: webView.frame.origin.x + dstCenter.x,
                    y: webView.frame.origin.y + dstCenter.y
                )
                let scaleX = max(0.16, min(0.5, dstW / srcRect.width))
                let scaleY = max(0.16, min(0.5, dstH / srcRect.height))
                let scale = min(scaleX, scaleY)

                // Bay Magic Move khớp 1:1 vào logo góc trên trái Header
                UIView.animate(
                    withDuration: duration,
                    delay: 0,
                    usingSpringWithDamping: 0.90,
                    initialSpringVelocity: 0.3,
                    options: [.curveEaseOut, .allowUserInteraction],
                    animations: {
                        logoView.center = targetCenterInContainer
                        logoView.transform = CGAffineTransform(scaleX: scale, y: scale)
                    },
                    completion: nil
                )

                // Hòa tan mượt đúng khoảnh khắc đáp xuống logo Header
                UIView.animate(
                    withDuration: 0.22,
                    delay: duration * 0.64,
                    options: [.curveEaseOut, .allowUserInteraction],
                    animations: {
                        logoView.alpha = 0.0
                    },
                    completion: nil
                )
            }

            // Mở màn nền Curtain êm dịu để lộ HomeScreen đang trượt lên mượt phía dưới
            UIView.animate(
                withDuration: duration * 0.84,
                delay: 0.02,
                options: [.curveEaseOut, .allowUserInteraction],
                animations: {
                    curtain.alpha = 0.0
                },
                completion: { [weak self] _ in
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.16) { [weak self] in
                        guard let self = self, self.transitionCounter == token else {
                            call.resolve(["animated": false])
                            return
                        }
                        self.cleanupOverlaysOnMain()
                        call.resolve(["animated": true])
                    }
                }
            )
        }
    }

    // MARK: - 5. Apple Metal CAEmitterLayer Confetti (Run / Test Pass 100%)

    @objc func playConfettiBurst(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self,
                  let webView = self.bridge?.webView,
                  let container = webView.superview else {
                call.resolve(["animated": false])
                return
            }

            let emitter = CAEmitterLayer()
            let topInset = webView.safeAreaInsets.top
            emitter.emitterPosition = CGPoint(x: container.bounds.midX, y: topInset + 22.0)
            emitter.emitterShape = .line
            emitter.emitterSize = CGSize(width: min(160.0, container.bounds.width * 0.42), height: 2.0)

            let palette: [UIColor] = [
                UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0),
                UIColor(red: 0.20, green: 0.83, blue: 0.60, alpha: 1.0),
                UIColor(red: 0.65, green: 0.55, blue: 0.98, alpha: 1.0),
                UIColor(red: 0.98, green: 0.75, blue: 0.14, alpha: 1.0),
                UIColor(red: 0.98, green: 0.44, blue: 0.52, alpha: 1.0)
            ]

            // Tạo 1 tấm confetti pixel nhỏ bằng UIGraphicsImageRenderer (tái sử dụng cho mọi hạt)
            let renderer = UIGraphicsImageRenderer(size: CGSize(width: 10, height: 6))
            let particleImage = renderer.image { ctx in
                UIColor.white.setFill()
                UIBezierPath(roundedRect: CGRect(x: 0, y: 0, width: 10, height: 6), cornerRadius: 2).fill()
            }.cgImage

            emitter.emitterCells = palette.map { color in
                let cell = CAEmitterCell()
                cell.birthRate = 18
                cell.lifetime = 1.45
                cell.lifetimeRange = 0.35
                cell.velocity = 195
                cell.velocityRange = 85
                cell.emissionLongitude = .pi * 0.5
                cell.emissionRange = .pi * 0.65
                cell.yAcceleration = 340
                cell.spin = 4.2
                cell.spinRange = 5.0
                cell.scale = 0.85
                cell.scaleRange = 0.35
                cell.alphaSpeed = -0.68
                cell.color = color.cgColor
                cell.contents = particleImage
                return cell
            }

            container.layer.addSublayer(emitter)

            // Ngắt sinh hạt sau 0.16s và gỡ layer sạch sau 1.7s
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.16) {
                emitter.birthRate = 0
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.75) {
                emitter.removeFromSuperlayer()
            }

            call.resolve(["animated": true])
        }
    }

    // MARK: - 6. Sync Native Window / WKWebView Backdrop Color (Chống chớp cạnh khi xoay iPad / Split View)

    @objc func syncBackdropColor(_ call: CAPPluginCall) {
        let hex = call.getString("hex")
        DispatchQueue.main.async { [weak self] in
            guard let self = self, let webView = self.bridge?.webView else {
                call.resolve()
                return
            }
            let bgColor = self.colorFromHex(hex, fallback: UIColor(red: 8/255, green: 12/255, blue: 24/255, alpha: 1))
            webView.backgroundColor = bgColor
            webView.scrollView.backgroundColor = bgColor
            self.bridge?.viewController?.view.backgroundColor = bgColor
            call.resolve()
        }
    }

    // MARK: - 7. Force Clear Any Stuck Overlay

    @objc func clearOverlay(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            self?.transitionCounter += 1
            self?.cleanupOverlaysOnMain()
            call.resolve()
        }
    }
}
