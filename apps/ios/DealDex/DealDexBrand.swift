import SwiftUI

enum DealDexCopy {
    static let subtitle = "Find the best-priced Pokémon card listings"
}

/// Official title wordmark (red Deal + blue Dex, yellow rim). Not the home-screen AppIcon.
struct DealDexTitle: View {
    var height: CGFloat = 36

    var body: some View {
        Image("DealDexWordmark")
            .resizable()
            .scaledToFit()
            .frame(height: height)
            .accessibilityLabel("DealDex")
    }
}

/// Isolated interlocking DD. Preview / in-app mark only — live AppIcon is the ST-grid catalog.
struct DealDexMark: View {
    var size: CGFloat = 36

    var body: some View {
        Image("DealDexMark")
            .resizable()
            .scaledToFit()
            .frame(width: size, height: size)
            .accessibilityHidden(true)
    }
}

// MARK: - Provider Marks

struct GoogleMark: View {
    var body: some View {
        Canvas { context, size in
            let blue = Color(red: 0x42 / 255, green: 0x85 / 255, blue: 0xF4 / 255)
            let green = Color(red: 0x34 / 255, green: 0xA8 / 255, blue: 0x53 / 255)
            let yellow = Color(red: 0xFB / 255, green: 0xBC / 255, blue: 0x05 / 255)
            let red = Color(red: 0xEA / 255, green: 0x43 / 255, blue: 0x35 / 255)
            let center = CGPoint(x: size.width / 2, y: size.height / 2)
            let radius = size.width * 0.42
            let lw = size.width * 0.18

            func arc(_ start: Double, _ end: Double, _ color: Color) {
                var p = Path()
                p.addArc(
                    center: center,
                    radius: radius,
                    startAngle: .degrees(start),
                    endAngle: .degrees(end),
                    clockwise: false
                )
                context.stroke(p, with: .color(color), style: StrokeStyle(lineWidth: lw, lineCap: .butt))
            }
            arc(-35, 20, blue)
            arc(20, 120, green)
            arc(120, 220, yellow)
            arc(220, 325, red)
            context.fill(
                Path(CGRect(
                    x: size.width * 0.48,
                    y: size.height * 0.42,
                    width: size.width * 0.42,
                    height: size.width * 0.16
                )),
                with: .color(blue)
            )
        }
        .accessibilityHidden(true)
    }
}

struct AppleMark: View {
    var body: some View {
        Image(systemName: "apple.logo")
            .font(.system(size: 20, weight: .medium))
            .accessibilityHidden(true)
    }
}

struct XMark: View {
    var body: some View {
        Canvas { context, size in
            let w = size.width
            let h = size.height
            var p = Path()
            p.move(to: CGPoint(x: w * 0.2, y: h * 0.2))
            p.addLine(to: CGPoint(x: w * 0.8, y: h * 0.8))
            p.move(to: CGPoint(x: w * 0.8, y: h * 0.2))
            p.addLine(to: CGPoint(x: w * 0.2, y: h * 0.8))
            context.stroke(
                p,
                with: .color(.primary),
                style: StrokeStyle(lineWidth: w * 0.15, lineCap: .round, lineJoin: .round)
            )
        }
        .accessibilityHidden(true)
    }
}

// MARK: - Styled Sign-In Button

struct SocialSignInButton<Mark: View>: View {
    let title: String
    var isBusy: Bool = false
    let action: () -> Void
    @ViewBuilder let mark: () -> Mark

    init(
        title: String,
        isBusy: Bool = false,
        action: @escaping () -> Void,
        @ViewBuilder mark: @escaping () -> Mark
    ) {
        self.title = title
        self.isBusy = isBusy
        self.action = action
        self.mark = mark
    }

    @Environment(\.colorScheme) private var colorScheme

    private var surface: Color {
        colorScheme == .dark
            ? Color(red: 0x13 / 255, green: 0x13 / 255, blue: 0x14 / 255)
            : .white
    }

    private var stroke: Color {
        colorScheme == .dark
            ? Color(red: 0x8E / 255, green: 0x91 / 255, blue: 0x8F / 255).opacity(0.6)
            : Color(red: 0x74 / 255, green: 0x77 / 255, blue: 0x75 / 255).opacity(0.6)
    }

    private var labelColor: Color {
        colorScheme == .dark
            ? Color(red: 0xE3 / 255, green: 0xE3 / 255, blue: 0xE3 / 255)
            : Color(red: 0x1F / 255, green: 0x1F / 255, blue: 0x1F / 255)
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                if isBusy {
                    ProgressView()
                        .frame(width: 20, height: 20)
                } else {
                    mark()
                        .frame(width: 20, height: 20)
                }
                Text(isBusy ? "Signing in…" : title)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundStyle(labelColor)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 16)
            .frame(maxWidth: .infinity, minHeight: 48)
            .background(surface, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .stroke(stroke, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .disabled(isBusy)
    }
}

