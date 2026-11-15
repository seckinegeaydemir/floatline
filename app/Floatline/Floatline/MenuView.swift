import SwiftUI

/// Floatline's brand orange, taken from the app icon's caption line.
private let brand = Color(red: 1.0, green: 0.42, blue: 0.29)
/// The dark screen colour of the app icon.
private let screen = Color(red: 0.11, green: 0.14, blue: 0.20)

struct MenuView: View {
    @ObservedObject var model: MenuModel

    var body: some View {
        let s = model.strings
        VStack(spacing: 12) {
            header(s)
            safariCard(s)
            captionCard(s)
            generalCard(s)
            footer(s)
        }
        .padding(14)
        .frame(width: 320)
        .tint(brand)
        .onAppear { model.refresh() }
    }

    // MARK: Sections

    private func header(_ s: Strings) -> some View {
        HStack(spacing: 12) {
            Image(nsImage: NSApplication.shared.applicationIconImage)
                .resizable()
                .frame(width: 44, height: 44)
            VStack(alignment: .leading, spacing: 2) {
                Text("Floatline")
                    .font(.system(size: 17, weight: .semibold, design: .rounded))
                Text(s["subtitle"])
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 2)
    }

    private func safariCard(_ s: Strings) -> some View {
        Card {
            HStack(alignment: .center, spacing: 10) {
                IconBadge(symbol: "safari", color: .blue)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(s["safari"]).font(.subheadline.weight(.medium))
                        StatusPill(text: statusText(s), color: statusColor)
                    }
                    Text(model.extensionState == .enabled ? s["safariOnHint"] : s["safariOffHint"])
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
            }
            Button {
                model.openSafariSettings()
            } label: {
                Label(s["openSettings"], systemImage: "gearshape")
                    .frame(maxWidth: .infinity)
            }
            .controlSize(.regular)
            .buttonStyle(.bordered)
        }
    }

    private func captionCard(_ s: Strings) -> some View {
        Card {
            HStack(spacing: 10) {
                IconBadge(symbol: "captions.bubble", color: brand)
                Text(s["captions"]).font(.subheadline.weight(.medium))
                Spacer()
                Text("%\(Int(model.captionScale))")
                    .font(.subheadline.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
            // A miniature PiP window showing the chosen caption size.
            ZStack(alignment: .bottom) {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(screen.gradient)
                Text(s["preview"])
                    .font(.system(size: 13 * model.captionScale / 100, weight: .medium))
                    .foregroundStyle(.white)
                    .shadow(color: .black.opacity(0.8), radius: 1, y: 1)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .minimumScaleFactor(0.5)
                    .padding(.horizontal, 12)
                    .padding(.bottom, 14)
            }
            .frame(height: 96)
            .animation(.easeOut(duration: 0.15), value: model.captionScale)

            HStack(spacing: 8) {
                Image(systemName: "textformat.size.smaller").foregroundStyle(.secondary)
                Slider(value: $model.captionScale,
                       in: Double(SharedSettings.captionScaleRange.lowerBound)...Double(SharedSettings.captionScaleRange.upperBound),
                       step: 10)
                Image(systemName: "textformat.size.larger").foregroundStyle(.secondary)
            }
            Text(s["nextPip"])
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private func generalCard(_ s: Strings) -> some View {
        Card {
            HStack(spacing: 10) {
                IconBadge(symbol: "globe", color: .purple)
                Text(s["language"]).font(.subheadline.weight(.medium))
                Spacer()
            }
            Picker(s["language"], selection: $model.language) {
                Text(s["system"]).tag("system")
                Text("Türkçe").tag("tr")
                Text("English").tag("en")
            }
            .pickerStyle(.segmented)
            .labelsHidden()

            Divider()

            Toggle(isOn: Binding(
                get: { model.launchAtLogin },
                set: { model.setLaunchAtLogin($0) }
            )) {
                HStack(spacing: 10) {
                    IconBadge(symbol: "power", color: .green)
                    Text(s["launchAtLogin"]).font(.subheadline)
                }
            }
            .toggleStyle(.switch)
            .controlSize(.small)
            if let error = model.launchAtLoginError {
                Text(s.format("loginError", error))
                    .font(.caption)
                    .foregroundStyle(.red)
            }
        }
    }

    private func footer(_ s: Strings) -> some View {
        HStack(alignment: .center) {
            Text(s["hint"])
                .font(.caption)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 8)
            Button(s["quit"]) { NSApplication.shared.terminate(nil) }
                .buttonStyle(.borderless)
                .foregroundStyle(.secondary)
                .keyboardShortcut("q")
        }
        .padding(.horizontal, 2)
    }

    // MARK: Status

    private func statusText(_ s: Strings) -> String {
        switch model.extensionState {
        case .enabled: return s["on"]
        case .disabled: return s["off"]
        case .unknown: return s["unknown"]
        }
    }

    private var statusColor: Color {
        switch model.extensionState {
        case .enabled: return .green
        case .disabled: return .orange
        case .unknown: return .gray
        }
    }
}

// MARK: Building blocks

private struct Card<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 10) { content }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Color.primary.opacity(0.05))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(Color.primary.opacity(0.08))
            )
    }
}

private struct IconBadge: View {
    let symbol: String
    let color: Color

    var body: some View {
        Image(systemName: symbol)
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(.white)
            .frame(width: 24, height: 24)
            .background(RoundedRectangle(cornerRadius: 6, style: .continuous).fill(color.gradient))
    }
}

private struct StatusPill: View {
    let text: String
    let color: Color

    var body: some View {
        HStack(spacing: 4) {
            Circle().fill(color).frame(width: 6, height: 6)
            Text(text).font(.caption2.weight(.semibold))
        }
        .padding(.horizontal, 7)
        .padding(.vertical, 2)
        .background(Capsule().fill(color.opacity(0.15)))
        .foregroundStyle(color)
    }
}
