import SwiftUI

struct CardDossierView: View {
    let card: TcgCard
    @State private var selectedFinish: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack(alignment: .top, spacing: 16) {
                    if let imgUrl = card.image, let url = URL(string: imgUrl) {
                        AsyncImage(url: url) { phase in
                            switch phase {
                            case .success(let image):
                                image.resizable().scaledToFit()
                            default:
                                RoundedRectangle(cornerRadius: 8)
                                    .fill(Color(white: 0.9))
                                    .overlay(ProgressView())
                            }
                        }
                        .frame(width: 130, height: 180)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    } else {
                        RoundedRectangle(cornerRadius: 8)
                            .fill(Color(white: 0.9))
                            .frame(width: 130, height: 180)
                            .overlay(Text("No scan").font(.caption).foregroundStyle(.secondary))
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        Text(card.setName.uppercased())
                            .font(.caption2.weight(.semibold))
                            .tracking(1.2)
                            .foregroundStyle(.secondary)
                        Text(card.name)
                            .font(.title2.weight(.bold))
                        Text("#\(card.localId)\(card.rarity.map { " · \($0)" } ?? "")")
                            .font(.caption)
                            .foregroundStyle(.secondary)

                        if let market = activeFinish?.market {
                            Text(String(format: "$%.2f", market))
                                .font(.system(.title3, design: .monospaced).weight(.bold))
                                .padding(.top, 4)
                            Text("TCGPlayer Market · \(activeFinish?.label ?? "")")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }

                        if let cm = card.cardmarketEur {
                            Text(String(format: "Cardmarket €%.2f", cm))
                                .font(.caption.monospaced())
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                .padding()
                .background(RoundedRectangle(cornerRadius: 12).fill(Color.white))

                if card.finishes.count > 1 {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("FINISHES")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(.secondary)
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack {
                                ForEach(card.finishes, id: \.key) { f in
                                    Button {
                                        selectedFinish = f.key
                                    } label: {
                                        Text("\(f.label) \(f.market.map { String(format: "$%.2f", $0) } ?? "")")
                                            .font(.caption)
                                    }
                                    .buttonStyle(.bordered)
                                    .tint((selectedFinish ?? card.finishes.first?.key) == f.key ? Color(red: 0.25, green: 0.29, blue: 0.20) : .secondary)
                                }
                            }
                        }
                    }
                    .padding(.horizontal)
                }

                // External links
                VStack(alignment: .leading, spacing: 8) {
                    Text("MARKETPLACES & COMPS")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(.secondary)
                        .padding(.horizontal)

                    HStack(spacing: 8) {
                        if let tcgUrl = tcgplayerSearchUrl() {
                            Link(destination: tcgUrl) {
                                HStack {
                                    Text("TCGPlayer")
                                    Image(systemName: "arrow.up.right")
                                }
                                .font(.caption.weight(.medium))
                                .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(Color(red: 0.15, green: 0.35, blue: 0.65))
                        }

                        if let ebayUrl = ebaySoldSearchUrl() {
                            Link(destination: ebayUrl) {
                                HStack(spacing: 4) {
                                    MarketplaceMark(market: "ebay")
                                    Text("sold").font(.caption.weight(.medium))
                                }
                                .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.bordered)
                        }

                        if let mercUrl = mercariSearchUrl() {
                            Link(destination: mercUrl) {
                                MarketplaceMark(market: "mercari")
                                    .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.bordered)
                        }
                    }
                    .padding(.horizontal)
                }

                // Quick Evaluator for this card
                VStack(alignment: .leading, spacing: 12) {
                    Text("APPRAISE A LISTING")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(.secondary)

                    NavigationLink {
                        EvaluatorView(initialCard: card)
                    } label: {
                        HStack {
                            Image(systemName: "slider.horizontal.3")
                            Text("Open in Evaluator")
                            Spacer()
                            Image(systemName: "chevron.right")
                        }
                        .font(.subheadline.weight(.semibold))
                        .padding()
                        .background(RoundedRectangle(cornerRadius: 10).fill(Color.white))
                    }
                    .buttonStyle(.plain)
                }
                .padding()
            }
            .padding(.vertical)
        }
        .background(Color(red: 0.95, green: 0.94, blue: 0.90))
        .navigationTitle(card.name)
        .navigationBarTitleDisplayMode(.inline)
    }

    private var activeFinish: Finish? {
        if let key = selectedFinish {
            return card.finishes.first { $0.key == key }
        }
        return card.finishes.first
    }

    private func tcgplayerSearchUrl() -> URL? {
        let q = "\(card.name) \(card.setName)".addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        return URL(string: "https://www.tcgplayer.com/search/pokemon/product?q=\(q)")
    }

    private func ebaySoldSearchUrl() -> URL? {
        let q = "\(card.name) \(card.setName) \(card.localId)".addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        return URL(string: "https://www.ebay.com/sch/i.html?_nkw=\(q)&LH_Sold=1&LH_Complete=1&_sop=13")
    }

    private func mercariSearchUrl() -> URL? {
        let q = "\(card.name) \(card.setName)".addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        return URL(string: "https://www.mercari.com/search/?keyword=\(q)")
    }
}
