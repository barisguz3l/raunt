# Raunt tasarım planı (v3, "Köşe")

Kaynak yönerge: Anthropic `frontend-design` becerisi (kullanıcı 19.11.2026'da kurulmasını ve tasarımın buna göre yapılmasını istedi). Bağlayıcı brief maddeleri: `CLAUDE.md` › Arayüz (koyu tema, dev sayaç, kontroller ≥64 px, Duraklat ≥96 px, renge ek olarak şekil/metin, azaltılmış hareket) ve spec §3.3 faz renkleri.

## Konu, kitle, birincil iş
- **Konu:** Türk kickboks salonu. Ring, iki köşe (kırmızı / mavi), el bandajı, raunt tabelası, maç afişi.
- **Kitle:** Başlangıç seviyesi sporcu; haftada üç gün salonda, diğer günler evde. Telefon 1,5–2 m uzakta, ellerde eldiven.
- **Birincil iş:** Bugünkü doğru seansı tek dokunuşla başlatmak; antrenmanda sayacı ve çağrıyı uzaktan okumak.

## İlk taslak (v1)
- Renk: siyaha yakın zemin (#0C0C10), kırmızı-turuncu degrade vurgu, yarı saydam kartlar.
- Yazı: sistem yazısı, 900 kalınlık başlıklar.
- Yerleşim: her şey eşit yuvarlak kartlarda; 2 sütunlu mod kartı ızgarası; yüzen hap biçimli sekme çubuğu; başlıkların üstünde büyük harfli küçük etiketler.

## Eleştiri: v1 neden varsayılan, ne değişti
| v1 | Neden varsayılan | v3 kararı |
|---|---|---|
| Siyaha yakın zemin + tek parlak vurgu + degrade | Yönergedeki 2. küme; her spor uygulamasında da aynı | Zemin **ring gecesi laciverti**; iki vurgu var ve ikisi de **anlam taşıyor**: kırmızı köşe = vur/başlat, mavi köşe = toparlan/kaydet. Degrade yok. |
| Aynı yarıçaplı kart kiti, her şey kutuda | 4. küme | Liste satırları ince çizgiyle ayrılır (maç kartındaki gibi), kutu yalnızca bugünün seansı ve alt sayfalar için. Yarıçap hiyerarşiye göre: kontrol 10, seans kartı 4 (tabela), alt sayfa 22. |
| Büyük harfli etiketler, "A · B · C" meta satırları | 5. küme | Etiketler cümle düzeninde; kombo adımları ayrı "bant" parçaları olarak dizilir; nokta yerine düz cümle ya da yapı. |
| 2 sütun eşit mod kartı | SaaS ızgarası | Modlar, maç kartı gibi tek sütun liste: sol kenarda köşe rengi şeridi (tür bilgisi), büyük dar başlık, tek satır açıklama. |
| Yüzen hap sekme çubuğu | Güncel iOS varsayılanı | Düz, tam genişlik çubuk; etkin sekmenin üstünde kırmızı çizgi (ring ipi). |
| Sistem yazısı 900 | Konudan bağımsız | **Barlow Condensed** (afiş ve raunt tabelası karakteri, dar olduğu için uzun Türkçe kelimeler ve dev sayılar sığar, rakamlar sabit genişlik). Gövde sistem yazısı. |

Revizyonda en çok tartıştığım nokta: dar grotesk bir spor uygulaması için tahmin edilebilir mi? Kalıyor, çünkü işlevsel: 2 m'den okunan sayaç ve 360 px ekranda "Kombinasyon Koçu" gibi uzun adlar dar yazıyla tek satıra sığar. Afiş hissi yalnızca başlık ve sayılarda; gövde sade.

## Tokenlar
**Renk**
| Ad | Hex | Rol |
|---|---|---|
| Ring gecesi | `#111A29` | Zemin |
| Köşe minderi | `#1A2537` | Yükseltilmiş yüzey (seans kartı, alt sayfa) |
| Bandaj | `#ECE8DF` | Ana metin |
| İp grisi | `#8E99AC` | İkincil metin, çizgiler |
| Kırmızı köşe | `#E5333F` | Başlat, raunt, vuruş modları |
| Mavi köşe | `#4A8BFF` | Dinlenme, toparlanma rutinleri, kayıt/ilerleme |

Antrenman ekranı faz renkleri spec §3.3'teki gibi kalır (uzaktan okunurluk ve renk körü etiketleri zaten tanımlı).

**Yazı**
- Barlow Condensed 800: ekran başlıkları, seans adı, sayaç, kombo adımları, büyük sayılar. Sıkı satır aralığı (1.0–1.05), harf aralığı 0.
- Barlow Condensed 600: bölüm başlıkları.
- Sistem yazısı 400/600: gövde, açıklama, form. 17 px, satır aralığı 1.45, satır ≤ 70 karakter.
- Ölçek (px): 64 / 40 / 28 / 21 / 17 / 14.

**Yerleşim:** tek sütun, sola hizalı, 20 px kenar boşluğu.

```
Bugün                              Antrenman
┌─────────────────────────────┐    Vuruş çalışması
│Hafta 2, Salı                │    ▌Raunt zamanlayıcı
│TEKNİK: KOMBOLAR VE TEKME    │    ▌ Hazırlık, raunt, dinlenme
│▇▇▇│▇▇▇▇▇▇│▇▇▇▇│▇▇│  55 dk   │    ────────────────────────
│ısın  kombo  tekme  esneme   │    ▌Kombinasyon koçu
│[      Seansı başlat       ] │    ▌ Koç Türkçe kombo söyler
└─────────────────────────────┘    ────────────────────────
Bu hafta  ○ ○ ● ○ ○ ○ ○            Isınma ve toparlanma
```
Bugünün seans kartında blok şeridi gerçek bilgidir: seansın bölümleri dakikalarıyla orantılı.

## İlkeler
1. Cesaret tek yerde: dar afiş yazısıyla seans adı ve dev sayaç. Gerisi sakin.
2. Renk = köşe. Kırmızı bir şey "başla, vur" demek; mavi bir şey "toparlan, kaydet". Süsleme için renk yok.
3. Yapı bilgi taşır: çizgi, şerit ve numara yalnızca sıra/tür anlatıyorsa.
4. Kendiliğinden hareket yok; animasyon yalnızca dokunuşa yanıt ve antrenman çağrıları için.
5. Metin: cümle düzeni, eylemi söyleyen düğmeler ("Seansı başlat"), etiket yığını yok.

## Notlar (sonraki denemeler için)
- v2'de denenen ve bırakılan: turuncu-kırmızı degrade, cam efektli yüzen sekme çubuğu, 9 renkli mod kartı.

## Uygulama notları (19.11.2026)
- Değişenler: Bugün seans kartı (raunt tabelası, köşe rengine göre üst şerit, dakikayla orantılı bölüm şeridi), Antrenman ve Kütüphane girişleri maç kartı listesi, düz sekme çubuğu, bölümlü haftalık hedef halkası (her seans bir dilim), hafta şeridinde şekille gün türü (kare salon, daire ev, kesikli dinlenme), kombo adımları ayrı bant parçaları, çöp adamda ön kol/bacak mavi.
- Seçili durumlar nötr (bandaj rengi zemin); kırmızı yalnızca başlat düğmeleri ve vuruş modlarında.
- Kaldırılanlar: tüm degradeler, kart gölgeleri, süs emojileri (bölüm başlıkları, haplar), büyük harfli etiketler, "·" ile birleştirilmiş meta satırlar, aynı hafta içinde iki kez "Paz"/"Cum" görünen kısaltma hatası.
- Bilinçli olarak bırakılan: antrenman ekranı faz renkleri (spec §3.3), seri emojisi (yalnızca "Seri ve rozetler" açıkken).
- Sonraki denemede: ayarlar ve alt sayfalardaki form öğeleri hâlâ eski kutulu düzene yakın; tek tek elden geçirilebilir.
