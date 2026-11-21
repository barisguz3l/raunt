Merhaba! Bu klasörde "Raunt" adlı, tamamen Türkçe bir kickboks antrenman uygulaması için eksiksiz bir ürün+teknik spesifikasyon var:
- KICKBOKS_UYGULAMA_SPEC.md (ana belge, tek doğru kaynak)
- CLAUDE.md (çalışma kuralları)
- seed/*.json (başlangıç içerik verisi: hareketler, 42 kombo, egzersizler, 3 haftalık program, testler)

Görev: Spesifikasyondaki §7 yol haritasını M0'dan başlayarak sırayla uygula (native iOS, Swift + SwiftUI, iOS 17+, SwiftData, XcodeGen).
Kurallar:
1. Önce KICKBOKS_UYGULAMA_SPEC.md ve CLAUDE.md'yi baştan sona oku, sonra M0 için kısa bir plan yaz ve uygula.
2. Her milestone sonunda testleri çalıştır (xcodebuild test), kabul kriterlerini madde madde raporla ve commit at. Kriterler sağlanmadan sonraki milestone'a geçme.
3. Sadece MVP kapsamını yap (§2.16). v2/v3'e ben söylemeden geçme.
4. Tüm kullanıcı metinleri Türkçe (Localizable.xcstrings).
5. Rakip uygulamaların içeriğini, seslerini, markalarını kopyalama (§9). Zil seslerini kendin üret.
6. Belirsiz kalan yerde makul varsayım yap, docs/KARARLAR.md'ye yaz, devam et. Sadece gerçek cihazda yapmam gereken testleri (ses, kilit ekranı, Health) bana görev olarak ver.
7. Mac'te Xcode ve XcodeGen kurulu mu kontrol et; değilse kurulum adımlarını söyle.
Başla: M0.
