# Raunt — Web (PWA) Geliştirme Planı v2 (araştırmayla genişletilmiş)

> Kaynaklar: `KICKBOKS_UYGULAMA_SPEC.md` (ana belge) + `reports/Raunt ek özellik araştırması.md` (rakipler, iOS web sınırları, spor bilimi, motivasyon, Türkiye bağlamı).
> Platform kararı (kullanıcı, 18.11.2026): **Web uygulaması (PWA)**, iPhone'da Safari › Paylaş › Ana Ekrana Ekle.

## 1. Teknoloji
| Katman | Seçim |
|---|---|
| Kod | React 18 + TypeScript + Vite; test: Vitest (+ Testing Library) |
| Bağımlılık | Çalışma zamanında yalnızca React. Diğer her şey Web API'leri |
| Çevrimdışı | Elle yazılmış service worker (tüm dosyalar + ses paketi önbellekte), manifest, `display: standalone` |
| Veri | Sabit içerik: `seed/*.json` · Kullanıcı verisi: IndexedDB (sürümlü şema) + `navigator.storage.persist()` · JSON yedek dışa/içe aktarma (Web Share) |
| Ses | **Önceden üretilmiş Türkçe ses klipleri** (birincil) + Web Speech API (yedek, serbest metin) + Web Audio ile kodla üretilen zil/gong/tak-tak sesleri |
| Ekran | Screen Wake Lock (iOS 18.4+), Media Session (kısmi), `visibilitychange` telafisi |
| Animasyon | SVG/Canvas + `requestAnimationFrame` (pad modu, çöp adam) |

### 1.1 Araştırmanın değiştirdiği temel kararlar
1. **Ses paketi birincil kaynak.** iOS 18+ Safari web'e yalnızca düşük kaliteli sesleri açıyor; Türkçe ses garantisi yok. Bu yüzden ~200 kısa klip (sayılar, hareket adları sol/sağ/ön/arka varyantlarıyla, sistem cümleleri, hoca komutları) bu bilgisayardaki **Microsoft Tolga (tr-TR)** sesiyle bir betikle üretilip pakete konur. Lisans notu `docs/SES_LISANSLARI.md`'ye (kişisel kullanım). v3: kendi sesini kaydet.
2. **Ses testi + kurtarma ekranı.** iOS 26 ana ekran PWA'larında ses bazen sadece ilk açılışta çalışıyor (WebKit 291892/295518). Her antrenman "Başla" dokunuşunda sesi sınar; çalışmazsa "uygulamayı kapat-aç / Safari'de aç" ekranı; antrenman görsel sinyallerle de taşınabilir.
3. **Zamanlayıcı zaman damgasıyla.** Tek doğru kaynak `performance.now()` tabanlı çizelge; arka plandan dönünce kaçan olaylar telafi edilir, uygulamadan çıkılırsa otomatik duraklar.
4. **Titreşim yok** (iOS'ta `vibrate` desteklenmiyor) → tam ekran renk flaşı + büyük metin.
5. **Bildirim yok** (sunucusuz yerel bildirim iOS'ta yok) → uygulama içi kartlar + **alarmlı `.ics` takvim dosyası** (antrenman, ders günlüğü, öğle yemeği, su).
6. **Müzik:** iki mod — "Müzikle karıştır" (sessiz anahtarda duyulmaz) / "Her zaman duyulsun" (müziği durdurabilir). Ayrı koç sesi / zil / efekt kaydırıcıları.
7. **Spor bilimi kuralları:** seans RPE × dakika ile yük, "ani artış" uyarısı (risk yüzdesi yok, ACWR iddiası yok), %10–20 artış "temkinli varsayılan" etiketiyle, ısınmada kas başına <60 sn germe, uzun germe seans sonunda.
8. **Motivasyon:** günlük değil **haftalık seri**, ayda 2 donma hakkı, hastalık/sakatlık modu, dinlenme günü "tamamlandı" sayılır, suçluluk dili yok, oyunlaştırma kapatılabilir.
9. **Kalori:** arka planda, aralık olarak, "tahmini" etiketiyle, kapatılabilir. Kilo düşürme hilesi (sauna, sıvı kısıtlama) asla önerilmez.

### 1.2 Spec'ten düşen / değişen
| Spec | Web'de |
|---|---|
| Kilit ekranında ses, arka plan | Yok → ekran açık modu + uyarı |
| Apple Health / Watch | Yok → seanslar uygulama içinde, JSON yedek |
| Yerel bildirim | `.ics` takvim alarmı + uygulama içi kartlar |
| Haptik | Görsel flaş |
| SwiftData / XcodeGen / xcodebuild | IndexedDB / Vite / Vitest |

## 2. Kapsam: "Tam donanımlı MVP"
Spec'in MVP'si (§2.16) + araştırmanın MVP maddeleri + ucuz ve değerli v2 maddelerinin öne çekilmesi. Kalan v2/v3 maddeleri en sonda, istersen.

## 3. Aşamalar (her aşama sonunda: testler yeşil, tarayıcıda doğrulama, kabul raporu, commit)

### M0 — İskele
Vite+React+TS, 5 sekme (Bugün, Antrenman, Kütüphane, İlerleme, Ayarlar), koyu tema, tasarım sistemi (faz renkleri, ≥64 pt butonlar, Duraklat ≥96 pt), Türkçe metin kataloğu, manifest + service worker, IndexedDB katmanı, `ContentStore` + `SeedLoader`.
**Kabul:** 31 hareket, 42 kombo, 31 egzersiz, 21 gün, 7 test, 8 ön ayar decode olur; referans bütünlüğü testi geçer; uygulama çevrimdışı açılır.

### M1 — Raunt zamanlayıcı çekirdeği
`TimelineBuilder` → `CueEvent[]`, `WorkoutEngine` (hazırlık → raunt → uyarı → dinlenme → bitti; duraklat/devam/atla/bitir), enjekte edilebilir `Clock`. Aktif antrenman ekranı: dev sayaç, faz renkleri, uyarıda yanıp sönme (azaltılmış harekette sabit), raunt göstergesi, **kalan raunt**, son 10 sn, uzun basışla Bitir. 8 ön ayar + **WAKO Ring 3×2/1, WAKO Tatami, Muay Thai** + kendi ön ayarın.
**Kabul:** spec M1 kriterleri (3×2 dk / 30 sn / 10 sn hazırlık birim testle doğru, duraklatma süreyi korur, yatay/dikey düzgün).

### M2 — Ses motoru ve ekran
Web Audio ile kodla üretilen 6 zil seti (Klasik, Gong, Tak-tak, Bip, Düdük, Sessiz), ses modu (karıştır/her zaman), ayrı ses kaydırıcıları, Wake Lock, `visibilitychange` telafisi + otomatik duraklatma, Media Session, **ses testi + kurtarma ekranı**, görsel faz flaşı.
**Kabul:** faz geçişlerinde doğru zil; sekme gizlenip açılınca süre doğru; ses kapalıyken antrenman görsel olarak takip edilebilir. (iPhone testi: sana görev.)

### M3 — Türkçe kombo koçu
Ses paketi üretim betiği (Tolga, tr-TR) + `SpeechProvider` (Klip → TTS yedeği → yalnızca yazı), `StanceMapper` (sol/sağ veya ön/arka adlandırma ayarı), `ComboScheduler` (4 tempo, tekme/diz sonrası ek boşluk, aynı kombo üst üste yok, son 3 tekrar yok, üst üste 2 tekmeli yok), sıralı/rastgele, **kombo ağırlıklandırma**, kombo kütüphanesi (filtre, arama, 🔒), kurulum ekranı, "Dinle" önizlemesi, **ekranda kombo yazısı**, raunt başı tanıtımı.
**Kabul:** spec M3 kriterleri ("1-2-3-LKR" sayı/isim/southpaw doğru söylenir, StanceMapper %100, tempo aralıkları tabloya uyar, hoca onayı kapalıyken 4 kilitli kombo havuzda yok, ses yoksa açık uyarı).

### M4 — Çağrı modları (rakiplerden eksikler)
Kombo editörü (adım ekle/sırala, **adım/pivot/feint adımları**, ≥2 ≤8 adım, ad önerisi), refleks modu (2–6 sn, %20 savunma), savunma çağrıları, **hedef bölge modu** (kafa/gövde/bacak), **kısıtlı raundlar** ("sadece jab + low kick"), **raunt ortası stance değiştir**, **raunt arası istasyonlar** (şınav, burpee, ip), **maç profili interval** (10–15 sn patlama + hafif hareket), hoca onayı ayarı, **kombo paylaşım bağlantısı/QR** (sunucusuz).
**Kabul:** kullanıcı kombosu rauntta çağrılır; refleks 2–6 sn aralıkla; kilitli hareket onaysız çağrılmaz; paylaşım bağlantısı açılınca kombo içe aktarılır.

### M5 — Pad modu
Ek A'daki konum tablosu (`PadLayout` saf fonksiyon, birim testli), yaklaşma halkası, yükselme/parlama, southpaw ayna, büyük numara etiketleri, renk + şekil, ses/görsel kaydırma ayarı (−300…+300 ms), azaltılmış hareket modu.
**Kabul:** her `padVisual` doğru konum/dönüşü verir (test); görsel-ses farkı ≤100 ms (ölçüm); 2 m'den okunur (iPhone testi).

### M6 — Kütüphane ve rehberli çalıştırıcılar
Teknik/egzersiz kartları (31), arama + **Türkçe eşanlamlı/yazım varyantı arama** (direk/direkt, kroşe…), **kick boks / Muay Thai etiketleri**, sık hatalar, koç ipucu, harici video bağlantısı (gömme yok), ≥9 çöp adam animasyonu (guard, jab, cross, hook, upper, knee, teep, low, plank), **RAMP sıralı ısınma**, esneme/kondisyon "hareket başına süreli" sesli çalıştırıcı, Kolay/Orta/Zor kademesi, **germe dozu sayacı** (kas grubu başına haftalık 5–10 dk), Türkçe terim sözlüğü ekranı.
**Kabul:** 31 kart görünür; ≥9 animasyon oynar; esneme rutini sırayla sayar ve sesli bildirir.

### M7 — Program, Bugün, günlük, hatırlatmalar
3 haftalık program + başlangıç tarihi, Bugün ekranı (günün kartı, BAŞLA, 3 haftalık mini takvim, yarın önizleme), `timerHint` → antrenman dönüşümü, ders günlüğü (4 soru + RPE → sonraki ev gününe "Ders tekrarı"), **onboarding'de if-then planı + engel planı**, beslenme/su planlayıcı (19:00 → öğle en geç 16:00–16:30), **`.ics` takvim dosyası**, pazar "haftanı planla" ekranı, **3 haftalık programdan sonra 12 haftalık blok devam önerisi** (temel → hafif hafta → kondisyon → yoğunlaştırma → test).
**Kabul:** 16.11.2026 başlangıcıyla 17.11 → "H1 Salı, Teknik + başlangıç testi"; salon günü günlük kartı çıkar; `.ics` iPhone takvimine alınır (iPhone testi).

### M8 — İlerleme, yük, güvenlik
Test girişi + protokol kartları + kronometre, karşılaştırma ("+4, +%133"), 3–4 haftada bir yeniden test hatırlatması, ölçümler (kilo, bel), seans geçmişi, **haftalık seri + donma hakkı + hastalık modu**, toplam seans/raunt (sıfırlanmaz), **sRPE yük grafiği + ani artış uyarısı**, **Hooper sabah anketi** (kişisel ortalamadan +3 → hafif seans önerisi), **ağrı haritası** (el/bilek, kaval, ayak bileği, diz, omuz, bel; ≥4 → yük azalt, kırmızı bayrakta doktora yönlendir), bel ağrısı akışı (diz plank / ölü böcek), kas ağrısı ≥7 uyarısı, **sarsıntı belirti kontrolü**, **ter kaybı tartısı** (%2 uyarısı), MET kalori (aralık, kapatılabilir), antrenman sonu kartı (su + protein), **beceri rozetleri** (zaman değil beceri; günlük tavan; kapatılabilir), **adaptif hedef önerisi**.
**Kabul:** başlangıç test seti girilir, final testte fark/yüzde görünür; bel ağrısı işaretlenince alternatif + uyarı; ani artış ve Hooper kuralları birim testli.

### M9 — Türkiye bağlamı
**TKBF kuşak yolculuğu** (mevcut kuşak, son sınav, en erken sonraki sınav = +3 ay, hoca onaylı teknik kontrol listesi; kuşak renk sırası kullanıcı seçimli — resmi sıra doğrulanana dek), **Ramazan modu** (iftar öncesi kısa/hafif veya iftar sonrası seçeneği, düşük yoğunluk, iftar–sahur su hedefi; vakitler kullanıcı girer), bayram/tatil modu (seriyi koruyan izin), yaz sıcağı su uyarısı, ilk turnuva kontrol listesi (yalnızca resmi bağlantılar), ekipman rehberi (kategori, marka yok).
**Kabul:** kuşak tarihi hesapları ve Ramazan modunun süre/yoğunluk düşürmesi birim testli.

### M10 — Cila ve sürüm
Onboarding (stance, seviye, hedefler, program tarihi, if-then planı, sağlık notu onayı), ayarlar tamamlama, JSON yedek/geri yükle, "Ana ekrana ekle" rehberi, erişilebilirlik (büyük yazı, VoiceOver etiketleri, azaltılmış hareket), uygulama simgesi + açılış ekranı, performans (açılış <2 sn), README (iPhone'a kurulum), `docs/TEST_PLANI_CIHAZ.md`.
**Kabul:** tüm birim testleri yeşil; tüm metinler Türkçe; iPhone test planı işaretli; 20 dk ekran açık antrenmanda hiç çağrı kaçmıyor.

### Sonrası (istersen)
Paylaşılabilir antrenman kartı, geçmiş kendine karşı yarış (ghost), kendi sesini kaydet, deneysel kamera gard kontrolü (MoveNet), telefonla vuruş sayacı.

## 4. Doğrulanması gerekenler
- TKBF kuşak sırası (resmi PDF okunamadı, 2010 tarihli) → bir hocaya / güncel talimata sor.
- Türkçe terimler ve 1–6 numara sistemi → hocana doğrulat; numara eşlemesi ayarlanabilir olacak.
- iOS 26.x'te PWA ses hatasının durumu → iPhone'da ses testi ekranıyla.
- Microsoft Tolga sesinin dağıtım lisansı → kişisel kullanım varsayıldı; yayınlanırsa kendi sesin veya lisanslı ses.

## 5. Yayınlama (iPhone'a ulaştırma)
HTTPS gerekli (service worker, Wake Lock). Öneri: ücretsiz GitHub Pages veya Netlify. M2 sonunda adım adım yaparız; o zamana kadar bu bilgisayarda tarayıcıda test.

## 6. Çalışma biçimi
Her aşama başında 3–5 maddelik plan → `docs/KARARLAR.md`; sonunda kabul kriterleri madde madde rapor; küçük commit'ler (`feat(M3): ...`). Rakip içeriği/sesi/markası kopyalanmaz (spec §9).
