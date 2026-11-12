import SwiftUI

enum WordmarkPaths {
    static func ebayEBowl() -> Path {
        var p = Path()
        p.move(to: CGPoint(x: 199.636, y: 185.866))
        p.addCurve(to: CGPoint(x: 127.695, y: 121.446), control1: CGPoint(x: 197.692, y: 138.989), control2: CGPoint(x: 163.856, y: 121.446))
        p.addCurve(to: CGPoint(x: 52.115, y: 185.866), control1: CGPoint(x: 88.701, y: 121.446), control2: CGPoint(x: 57.568, y: 141.179))
        p.closeSubpath()
        return p
    }

    static func ebayEBody() -> Path {
        var p = Path()
        p.move(to: CGPoint(x: 51.034, y: 219.191))
        p.addCurve(to: CGPoint(x: 128.232, y: 291.575), control1: CGPoint(x: 53.738, y: 264.675), control2: CGPoint(x: 85.104, y: 291.575))
        p.addCurve(to: CGPoint(x: 193.591, y: 252.915), control1: CGPoint(x: 158.112, y: 291.575), control2: CGPoint(x: 184.692, y: 279.400))
        p.addLine(to: CGPoint(x: 245.275, y: 252.915))
        p.addCurve(to: CGPoint(x: 128.972, y: 324.895), control1: CGPoint(x: 235.223, y: 306.655), control2: CGPoint(x: 178.121, y: 324.895))
        p.addCurve(to: CGPoint(x: 0.000, y: 209.307), control1: CGPoint(x: 39.606, y: 324.895), control2: CGPoint(x: 0.000, y: 275.679))
        p.addCurve(to: CGPoint(x: 129.788, y: 88.122), control1: CGPoint(x: 0.000, y: 136.242), control2: CGPoint(x: 40.966, y: 88.122))
        p.addCurve(to: CGPoint(x: 252.288, y: 205.878), control1: CGPoint(x: 200.487, y: 88.122), control2: CGPoint(x: 252.288, y: 125.121))
        p.addLine(to: CGPoint(x: 252.288, y: 219.191))
        p.closeSubpath()
        return p
    }

    static func ebayBBowl() -> Path {
        var p = Path()
        p.move(to: CGPoint(x: 380.832, y: 290.624))
        p.addCurve(to: CGPoint(x: 459.273, y: 206.515), control1: CGPoint(x: 427.404, y: 290.624), control2: CGPoint(x: 459.273, y: 257.102))
        p.addCurve(to: CGPoint(x: 380.832, y: 122.407), control1: CGPoint(x: 459.273, y: 155.933), control2: CGPoint(x: 427.404, y: 122.407))
        p.addCurve(to: CGPoint(x: 302.388, y: 206.515), control1: CGPoint(x: 334.521, y: 122.407), control2: CGPoint(x: 302.388, y: 155.933))
        p.addCurve(to: CGPoint(x: 380.832, y: 290.624), control1: CGPoint(x: 302.388, y: 257.102), control2: CGPoint(x: 334.521, y: 290.624))
        p.closeSubpath()
        return p
    }

    static func ebayBStem() -> Path {
        var p = Path()
        p.move(to: CGPoint(x: 252.285, y: 0.000))
        p.addLine(to: CGPoint(x: 302.388, y: 0.000))
        p.addLine(to: CGPoint(x: 302.388, y: 125.877))
        p.addCurve(to: CGPoint(x: 394.078, y: 88.122), control1: CGPoint(x: 326.945, y: 96.617), control2: CGPoint(x: 360.777, y: 88.122))
        p.addCurve(to: CGPoint(x: 511.929, y: 207.151), control1: CGPoint(x: 449.913, y: 88.122), control2: CGPoint(x: 511.929, y: 125.799))
        p.addCurve(to: CGPoint(x: 393.148, y: 324.896), control1: CGPoint(x: 511.929, y: 275.273), control2: CGPoint(x: 462.607, y: 324.896))
        p.addCurve(to: CGPoint(x: 301.461, y: 286.013), control1: CGPoint(x: 356.791, y: 324.896), control2: CGPoint(x: 322.567, y: 311.853))
        p.addCurve(to: CGPoint(x: 299.756, y: 316.577), control1: CGPoint(x: 301.461, y: 296.334), control2: CGPoint(x: 300.885, y: 306.737))
        p.addLine(to: CGPoint(x: 250.584, y: 316.577))
        p.addCurve(to: CGPoint(x: 252.290, y: 264.830), control1: CGPoint(x: 251.439, y: 300.668), control2: CGPoint(x: 252.290, y: 280.859))
        p.closeSubpath()
        return p
    }

    static func ebayALeft() -> Path {
        var p = Path()
        p.move(to: CGPoint(x: 633.078, y: 212.533))
        p.addCurve(to: CGPoint(x: 559.407, y: 252.152), control1: CGPoint(x: 587.639, y: 214.022), control2: CGPoint(x: 559.407, y: 222.222))
        p.addCurve(to: CGPoint(x: 614.070, y: 292.534), control1: CGPoint(x: 559.407, y: 271.528), control2: CGPoint(x: 574.854, y: 292.534))
        p.addCurve(to: CGPoint(x: 694.713, y: 216.871), control1: CGPoint(x: 666.647, y: 292.534), control2: CGPoint(x: 694.713, y: 263.875))
        p.addLine(to: CGPoint(x: 694.713, y: 211.701))
        p.addCurve(to: CGPoint(x: 633.076, y: 212.534), control1: CGPoint(x: 676.280, y: 211.701), control2: CGPoint(x: 653.549, y: 211.862))
        p.closeSubpath()
        return p
    }

    static func ebayABody() -> Path {
        var p = Path()
        p.move(to: CGPoint(x: 744.829, y: 274.636))
        p.addCurve(to: CGPoint(x: 746.523, y: 316.577), control1: CGPoint(x: 744.829, y: 289.219), control2: CGPoint(x: 745.251, y: 303.614))
        p.addLine(to: CGPoint(x: 699.909, y: 316.577))
        p.addCurve(to: CGPoint(x: 698.212, y: 285.010), control1: CGPoint(x: 698.666, y: 305.903), control2: CGPoint(x: 698.212, y: 295.297))
        p.addCurve(to: CGPoint(x: 601.450, y: 324.896), control1: CGPoint(x: 673.010, y: 315.990), control2: CGPoint(x: 643.035, y: 324.896))
        p.addCurve(to: CGPoint(x: 506.750, y: 254.589), control1: CGPoint(x: 539.774, y: 324.896), control2: CGPoint(x: 506.750, y: 292.296))
        p.addCurve(to: CGPoint(x: 629.640, y: 178.935), control1: CGPoint(x: 506.750, y: 199.977), control2: CGPoint(x: 551.666, y: 180.722))
        p.addCurve(to: CGPoint(x: 694.715, y: 178.376), control1: CGPoint(x: 650.963, y: 178.448), control2: CGPoint(x: 674.914, y: 178.376))
        p.addLine(to: CGPoint(x: 694.715, y: 173.040))
        p.addCurve(to: CGPoint(x: 630.647, y: 121.447), control1: CGPoint(x: 694.715, y: 136.479), control2: CGPoint(x: 671.271, y: 121.447))
        p.addCurve(to: CGPoint(x: 575.971, y: 155.494), control1: CGPoint(x: 600.489, y: 121.447), control2: CGPoint(x: 578.261, y: 133.927))
        p.addLine(to: CGPoint(x: 523.319, y: 155.494))
        p.addCurve(to: CGPoint(x: 635.059, y: 88.123), control1: CGPoint(x: 528.891, y: 101.722), control2: CGPoint(x: 585.386, y: 88.123))
        p.addCurve(to: CGPoint(x: 744.832, y: 172.238), control1: CGPoint(x: 694.568, y: 88.123), control2: CGPoint(x: 744.832, y: 109.296))
        p.closeSubpath()
        return p
    }

    static func ebayE() -> Path {
        var p = ebayEBowl()
        p.addPath(ebayEBody())
        return p
    }

    static func ebayB() -> Path {
        var p = ebayBBowl()
        p.addPath(ebayBStem())
        return p
    }

    static func ebayA() -> Path {
        var p = ebayALeft()
        p.addPath(ebayABody())
        return p
    }

    static func ebayY() -> Path {
        var p = Path()
        p.move(to: CGPoint(x: 1000.000, y: 96.457))
        p.addLine(to: CGPoint(x: 845.055, y: 400.751))
        p.addLine(to: CGPoint(x: 788.949, y: 400.751))
        p.addLine(to: CGPoint(x: 833.496, y: 316.256))
        p.addLine(to: CGPoint(x: 716.890, y: 96.457))
        p.addLine(to: CGPoint(x: 775.517, y: 96.457))
        p.addLine(to: CGPoint(x: 861.322, y: 268.188))
        p.addLine(to: CGPoint(x: 946.885, y: 96.457))
        p.closeSubpath()
        return p
    }

    static func mercariM() -> Path {
        var p = Path()
        p.move(to: CGPoint(x: 17.200, y: 33.300))
        p.addLine(to: CGPoint(x: 26.600, y: 15.200))
        p.addLine(to: CGPoint(x: 34.100, y: 15.200))
        p.addLine(to: CGPoint(x: 34.100, y: 48.700))
        p.addLine(to: CGPoint(x: 26.700, y: 48.700))
        p.addLine(to: CGPoint(x: 26.700, y: 29.500))
        p.addLine(to: CGPoint(x: 26.600, y: 29.500))
        p.addLine(to: CGPoint(x: 19.400, y: 42.400))
        p.addLine(to: CGPoint(x: 14.600, y: 42.400))
        p.addLine(to: CGPoint(x: 7.500, y: 29.500))
        p.addLine(to: CGPoint(x: 7.400, y: 29.500))
        p.addLine(to: CGPoint(x: 7.400, y: 48.600))
        p.addLine(to: CGPoint(x: 0.000, y: 48.600))
        p.addLine(to: CGPoint(x: 0.000, y: 15.100))
        p.addLine(to: CGPoint(x: 7.500, y: 15.100))
        p.addLine(to: CGPoint(x: 17.000, y: 33.300))
        p.addLine(to: CGPoint(x: 17.200, y: 33.300))
        p.closeSubpath()
        return p
    }

    static func mercariE() -> Path {
        var p = Path()
        p.move(to: CGPoint(x: 72.000, y: 54.500))
        p.addLine(to: CGPoint(x: 72.000, y: 47.600))
        p.addLine(to: CGPoint(x: 54.700, y: 47.600))
        p.addLine(to: CGPoint(x: 54.700, y: 41.200))
        p.addLine(to: CGPoint(x: 71.200, y: 41.200))
        p.addLine(to: CGPoint(x: 71.200, y: 34.400))
        p.addLine(to: CGPoint(x: 54.700, y: 34.400))
        p.addLine(to: CGPoint(x: 54.700, y: 27.700))
        p.addLine(to: CGPoint(x: 72.000, y: 27.700))
        p.addLine(to: CGPoint(x: 72.000, y: 21.000))
        p.addLine(to: CGPoint(x: 47.300, y: 21.000))
        p.addLine(to: CGPoint(x: 47.300, y: 54.500))
        p.addLine(to: CGPoint(x: 72.000, y: 54.500))
        p.closeSubpath()
        return p
    }

    static func mercariR1() -> Path {
        var p = Path()
        p.move(to: CGPoint(x: 107.600, y: 18.100))
        p.addCurve(to: CGPoint(x: 111.200, y: 26.200), control1: CGPoint(x: 110.000, y: 20.100), control2: CGPoint(x: 111.200, y: 22.800))
        p.addCurve(to: CGPoint(x: 104.800, y: 36.600), control1: CGPoint(x: 111.300, y: 30.600), control2: CGPoint(x: 108.800, y: 34.700))
        p.addLine(to: CGPoint(x: 112.200, y: 48.700))
        p.addLine(to: CGPoint(x: 103.800, y: 48.700))
        p.addLine(to: CGPoint(x: 97.400, y: 38.000))
        p.addLine(to: CGPoint(x: 92.100, y: 38.000))
        p.addLine(to: CGPoint(x: 92.100, y: 48.600))
        p.addLine(to: CGPoint(x: 84.700, y: 48.600))
        p.addLine(to: CGPoint(x: 84.700, y: 15.100))
        p.addLine(to: CGPoint(x: 98.500, y: 15.100))
        p.addCurve(to: CGPoint(x: 107.600, y: 18.100), control1: CGPoint(x: 102.200, y: 15.100), control2: CGPoint(x: 105.300, y: 16.100))
        p.closeSubpath()
        p.move(to: CGPoint(x: 97.300, y: 22.000))
        p.addLine(to: CGPoint(x: 92.100, y: 22.000))
        p.addLine(to: CGPoint(x: 92.100, y: 31.200))
        p.addLine(to: CGPoint(x: 97.300, y: 31.200))
        p.addCurve(to: CGPoint(x: 104.000, y: 26.500), control1: CGPoint(x: 101.800, y: 31.200), control2: CGPoint(x: 104.000, y: 29.600))
        p.addCurve(to: CGPoint(x: 97.300, y: 22.000), control1: CGPoint(x: 104.000, y: 23.400), control2: CGPoint(x: 101.800, y: 22.000))
        p.closeSubpath()
        return p
    }

    static func mercariC() -> Path {
        var p = Path()
        p.move(to: CGPoint(x: 147.400, y: 43.500))
        p.addCurve(to: CGPoint(x: 138.600, y: 48.100), control1: CGPoint(x: 145.200, y: 46.500), control2: CGPoint(x: 142.200, y: 48.100))
        p.addCurve(to: CGPoint(x: 131.500, y: 45.300), control1: CGPoint(x: 136.000, y: 48.200), control2: CGPoint(x: 133.400, y: 47.200))
        p.addCurve(to: CGPoint(x: 128.600, y: 37.700), control1: CGPoint(x: 129.600, y: 43.400), control2: CGPoint(x: 128.600, y: 40.900))
        p.addCurve(to: CGPoint(x: 131.500, y: 30.200), control1: CGPoint(x: 128.600, y: 34.500), control2: CGPoint(x: 129.600, y: 32.000))
        p.addCurve(to: CGPoint(x: 138.200, y: 27.400), control1: CGPoint(x: 133.300, y: 28.400), control2: CGPoint(x: 135.700, y: 27.400))
        p.addCurve(to: CGPoint(x: 146.800, y: 31.800), control1: CGPoint(x: 141.600, y: 27.300), control2: CGPoint(x: 144.800, y: 29.000))
        p.addLine(to: CGPoint(x: 146.900, y: 32.000))
        p.addLine(to: CGPoint(x: 151.900, y: 26.900))
        p.addLine(to: CGPoint(x: 151.800, y: 26.800))
        p.addCurve(to: CGPoint(x: 138.500, y: 20.500), control1: CGPoint(x: 148.400, y: 22.600), control2: CGPoint(x: 144.000, y: 20.500))
        p.addCurve(to: CGPoint(x: 126.000, y: 25.300), control1: CGPoint(x: 133.500, y: 20.500), control2: CGPoint(x: 129.300, y: 22.100))
        p.addCurve(to: CGPoint(x: 121.000, y: 37.900), control1: CGPoint(x: 122.700, y: 28.500), control2: CGPoint(x: 121.000, y: 32.700))
        p.addCurve(to: CGPoint(x: 126.000, y: 50.400), control1: CGPoint(x: 121.000, y: 43.000), control2: CGPoint(x: 122.700, y: 47.200))
        p.addCurve(to: CGPoint(x: 138.700, y: 55.100), control1: CGPoint(x: 129.300, y: 53.500), control2: CGPoint(x: 133.600, y: 55.100))
        p.addCurve(to: CGPoint(x: 152.300, y: 48.800), control1: CGPoint(x: 144.300, y: 55.100), control2: CGPoint(x: 148.800, y: 53.000))
        p.addLine(to: CGPoint(x: 152.400, y: 48.700))
        p.addLine(to: CGPoint(x: 147.500, y: 43.500))
        p.addLine(to: CGPoint(x: 147.400, y: 43.600))
        p.closeSubpath()
        return p
    }

    static func mercariA() -> Path {
        var p = Path()
        p.move(to: CGPoint(x: 172.200, y: 15.100))
        p.addLine(to: CGPoint(x: 179.100, y: 15.100))
        p.addLine(to: CGPoint(x: 192.100, y: 48.500))
        p.addLine(to: CGPoint(x: 184.500, y: 48.500))
        p.addLine(to: CGPoint(x: 182.100, y: 42.500))
        p.addLine(to: CGPoint(x: 169.200, y: 42.500))
        p.addLine(to: CGPoint(x: 166.800, y: 48.500))
        p.addLine(to: CGPoint(x: 159.100, y: 48.500))
        p.addLine(to: CGPoint(x: 159.200, y: 48.200))
        p.addLine(to: CGPoint(x: 172.200, y: 15.100))
        p.closeSubpath()
        p.move(to: CGPoint(x: 171.600, y: 36.000))
        p.addLine(to: CGPoint(x: 179.600, y: 36.000))
        p.addLine(to: CGPoint(x: 175.600, y: 25.400))
        p.addLine(to: CGPoint(x: 171.600, y: 36.000))
        p.closeSubpath()
        return p
    }

    static func mercariR2() -> Path {
        var p = Path()
        p.move(to: CGPoint(x: 224.700, y: 23.900))
        p.addCurve(to: CGPoint(x: 228.300, y: 32.000), control1: CGPoint(x: 227.100, y: 25.900), control2: CGPoint(x: 228.300, y: 28.600))
        p.addCurve(to: CGPoint(x: 221.900, y: 42.400), control1: CGPoint(x: 228.400, y: 36.400), control2: CGPoint(x: 225.900, y: 40.500))
        p.addLine(to: CGPoint(x: 229.300, y: 54.500))
        p.addLine(to: CGPoint(x: 220.900, y: 54.500))
        p.addLine(to: CGPoint(x: 214.400, y: 43.900))
        p.addLine(to: CGPoint(x: 209.100, y: 43.900))
        p.addLine(to: CGPoint(x: 209.100, y: 54.500))
        p.addLine(to: CGPoint(x: 201.700, y: 54.500))
        p.addLine(to: CGPoint(x: 201.700, y: 21.000))
        p.addLine(to: CGPoint(x: 215.500, y: 21.000))
        p.addCurve(to: CGPoint(x: 224.700, y: 23.900), control1: CGPoint(x: 219.300, y: 21.000), control2: CGPoint(x: 222.300, y: 21.900))
        p.closeSubpath()
        p.move(to: CGPoint(x: 214.400, y: 27.800))
        p.addLine(to: CGPoint(x: 209.200, y: 27.800))
        p.addLine(to: CGPoint(x: 209.200, y: 37.000))
        p.addLine(to: CGPoint(x: 214.400, y: 37.000))
        p.addCurve(to: CGPoint(x: 221.100, y: 32.300), control1: CGPoint(x: 218.900, y: 37.000), control2: CGPoint(x: 221.100, y: 35.400))
        p.addCurve(to: CGPoint(x: 214.400, y: 27.800), control1: CGPoint(x: 221.100, y: 29.300), control2: CGPoint(x: 219.000, y: 27.800))
        p.closeSubpath()
        return p
    }

    static func mercariI() -> Path {
        var p = Path()
        p.move(to: CGPoint(x: 240.400, y: 18.000))
        p.addLine(to: CGPoint(x: 247.700, y: 18.000))
        p.addLine(to: CGPoint(x: 247.700, y: 48.600))
        p.addLine(to: CGPoint(x: 240.400, y: 48.600))
        p.addLine(to: CGPoint(x: 240.400, y: 18.000))
        p.closeSubpath()
        return p
    }

    static func mercariDot() -> Path {
        var p = Path()
        p.move(to: CGPoint(x: 239.600, y: 8.000))
        p.addLine(to: CGPoint(x: 243.000, y: 0.000))
        p.addLine(to: CGPoint(x: 251.100, y: 3.400))
        p.addLine(to: CGPoint(x: 247.700, y: 11.400))
        p.addLine(to: CGPoint(x: 239.600, y: 8.000))
        p.closeSubpath()
        return p
    }

}


enum WordmarkFill {
    static let ebay = [
        Color(red: 0xF0 / 255, green: 0x2D / 255, blue: 0x2D / 255),
        Color(red: 0x09 / 255, green: 0x68 / 255, blue: 0xF6 / 255),
        Color(red: 1, green: 0xBD / 255, blue: 0x14 / 255),
        Color(red: 0x92 / 255, green: 0xC8 / 255, blue: 0x21 / 255),
    ]
    static let mercari = Color(red: 83 / 255, green: 86 / 255, blue: 238 / 255)
}

private struct ScaledFill: View {
    let path: Path
    let viewBox: CGSize
    let fill: Color
    var eoFill = false

    var body: some View {
        Canvas { ctx, size in
            let sx = size.width / viewBox.width
            let sy = size.height / viewBox.height
            let t = CGAffineTransform(scaleX: sx, y: sy)
            ctx.fill(path.applying(t), with: .color(fill), style: FillStyle(eoFill: eoFill))
        }
    }
}

/// Official eBay four-color wordmark (website `EbayWordmark`). White fills on chips.
/// Each letter is one compound path with even-odd so counters (holes) stay open
/// the same way the website SVG does — do not fill the bowl as a second solid.
struct EbayWordmark: View {
    var white = false
    var scale: CGFloat = 1
    private let box = CGSize(width: 1000, height: 400.751)

    var body: some View {
        let fills = white ? Array(repeating: Color.white, count: 4) : WordmarkFill.ebay
        ZStack {
            ScaledFill(path: WordmarkPaths.ebayE(), viewBox: box, fill: fills[0], eoFill: true)
            ScaledFill(path: WordmarkPaths.ebayB(), viewBox: box, fill: fills[1], eoFill: true)
            ScaledFill(path: WordmarkPaths.ebayA(), viewBox: box, fill: fills[2], eoFill: true)
            ScaledFill(path: WordmarkPaths.ebayY(), viewBox: box, fill: fills[3])
        }
        .frame(width: 35 * scale, height: 14 * scale)
        .fixedSize()
        .accessibilityLabel("eBay")
    }
}

/// Official Mercari wordmark (website `MercariWordmark`). White on chips, blue on rows.
struct MercariWordmark: View {
    var white = false
    var scale: CGFloat = 1
    private let box = CGSize(width: 251.1, height: 55)

    var body: some View {
        let fill = white ? Color.white : WordmarkFill.mercari
        ZStack {
            ScaledFill(path: WordmarkPaths.mercariM(), viewBox: box, fill: fill)
            ScaledFill(path: WordmarkPaths.mercariE(), viewBox: box, fill: fill)
            ScaledFill(path: WordmarkPaths.mercariR1(), viewBox: box, fill: fill, eoFill: true)
            ScaledFill(path: WordmarkPaths.mercariC(), viewBox: box, fill: fill)
            ScaledFill(path: WordmarkPaths.mercariA(), viewBox: box, fill: fill, eoFill: true)
            ScaledFill(path: WordmarkPaths.mercariR2(), viewBox: box, fill: fill, eoFill: true)
            ScaledFill(path: WordmarkPaths.mercariI(), viewBox: box, fill: fill)
            ScaledFill(path: WordmarkPaths.mercariDot(), viewBox: box, fill: fill)
        }
        .frame(width: 64 * scale, height: 14 * scale)
        .fixedSize()
        .accessibilityLabel("Mercari")
    }
}

struct MarketplaceMark: View {
    let market: String
    var white: Bool = false
    var scale: CGFloat = 1

    var body: some View {
        if market == "ebay" {
            EbayWordmark(white: white, scale: scale)
        } else {
            MercariWordmark(white: white, scale: scale)
        }
    }
}

/// Website source `MarketplaceToggle`: olive when that market is on, charcoal idle.
/// Listing counts sit on these toggles.  Do not add a second eBay/Mercari filter row.
struct MarketplaceToggle: View {
    let market: String
    let selected: Bool
    var count: Int? = nil
    var large: Bool = false
    let action: () -> Void

    private let accent = Color(red: 63 / 255, green: 74 / 255, blue: 50 / 255)
    private let idle = Color(red: 26 / 255, green: 27 / 255, blue: 22 / 255).opacity(0.80)

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                MarketplaceMark(market: market, white: true, scale: large ? 1.45 : 1)
                if let count {
                    Spacer(minLength: 0)
                    Text("\(count)")
                        .font(.body.monospacedDigit())
                        .fontWeight(.semibold)
                        .foregroundStyle(.white)
                }
            }
            .padding(.horizontal, large ? 16 : 12)
            .frame(maxWidth: large ? .infinity : nil, minHeight: large ? 56 : 44, alignment: .leading)
            .background(chipFill)
            .overlay(chipStroke)
            .opacity(selected ? 1 : 0.7)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    private var fillColor: Color { selected ? accent : idle }

    @ViewBuilder
    private var chipFill: some View {
        if large {
            RoundedRectangle(cornerRadius: 14).fill(fillColor)
        } else {
            Capsule().fill(fillColor)
        }
    }

    @ViewBuilder
    private var chipStroke: some View {
        if large {
            RoundedRectangle(cornerRadius: 14).stroke(selected ? accent : Color.primary.opacity(0.12), lineWidth: 1)
        } else {
            Capsule().stroke(selected ? accent : Color.primary.opacity(0.12), lineWidth: 1)
        }
    }

    private var label: String {
        let name = market == "ebay" ? "eBay" : "Mercari"
        if let count { return "\(name) \(count)" }
        return name
    }
}
