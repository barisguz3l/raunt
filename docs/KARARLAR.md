# Kararlar ve varsayımlar günlüğü

Belirsiz kalan yerlerde verilen kararlar (spec §0.5). En yeni en altta.

## Genel (18.11.2026)
- **Platform: Web (PWA).** Kullanıcı Windows'ta, Mac yok; seçeneklerden web'i seçti. Spec'teki native iOS mimarisi web karşılıklarıyla uygulanır (ayrıntı: `docs/PLAN.md` §1). Spec'in ürün ve içerik kısmı geçerliliğini korur.
- **Depo:** GitHub `raunt`; yayın GitHub Pages (Actions).
- **Araştırma:** `reports/Raunt ek özellik araştırması.md` bulgularıyla kapsam genişletildi (`docs/PLAN.md`).

## M0: İskele
Plan:
1. Vite + React 19 + TypeScript + Vitest; çalışma zamanı bağımlılığı yalnızca React.
2. `seed/` tek kaynak: uygulama JSON'u doğrudan `seed/`'den içe aktarır (kopya yok, kayma riski yok).
3. `SeedLoader` yapı doğrulaması + referans bütünlüğü; `ContentStore` id erişimi.
4. Kullanıcı verisi IndexedDB (`kv` + 7 koleksiyon), JSON yedek dışa/içe aktarma şimdiden.
5. Elle yazılmış service worker (derlemede dosya listesi otomatik), manifest, SVG ikon.

Kararlar:
- **Metinler** `src/i18n/tr.ts` içinde tek nesnede (Swift'teki String Catalog karşılığı). Kod içinde serbest Türkçe metin yok.
- **Yönlendirme:** kütüphane yok; `#/bugun` gibi hash tabanlı sekme durumu (GitHub Pages'te sunucu ayarı gerektirmez).
- **Tarih hesapları** `YYYY-MM-DD` string + UTC gün numarası ile (saat dilimi/yaz saati kaymasına karşı). Program günü hesabı M0'da eklendi; spec M8 kabul örneği (16.11 başlangıç → 17.11 = H1 Salı) birim testli.
- **Service worker yalnızca üretim derlemesinde** kayıtlı; önbellek adı içerik özetinden, yeni sürüm eskisini siler. Ağ isteği yapılmaz (F-1500).
- **`requiresCoachApproval` tutarlılığı** test ediliyor: kombo bayrağı, adımlarındaki `coachApproval` hareketlerinden türetilen değerle aynı olmalı.
- **İkon:** şimdilik SVG. iOS ana ekran ikonu için PNG M10'da (apple-touch-icon SVG'yi her iOS sürümü desteklemez).
- **TypeScript 7 / Vite 8 / Vitest 5** (kurulum anındaki güncel sürümler).
- `persist()` masaüstü Chromium önizlemesinde reddedildi (normal; site etkileşimi azken izin verilmez). iPhone'da ana ekran uygulamasında tekrar denenecek; reddedilirse Ayarlar uyarısı + yedek önerisi gösteriliyor.

## M1: Raunt zamanlayıcı çekirdeği
Plan:
1. `buildTimeline(config)` → fazlar (`segments`) + olaylar (`cues`); saf fonksiyon.
2. `WorkoutEngine`: süre her an saatten hesaplanır (`Clock` enjeksiyonu); duraklat/devam/atla/bitir.
3. Ziller Web Audio ile kodla üretilir; `SoundScheduler` sesleri ses saatine önceden kurar.
4. Kurulum ekranı (11 ön ayar + kendi ön ayarın), tam ekran aktif antrenman, ekran uyanık.

Kararlar:
- **Uyarı fazı rauntun parçası:** sayaç uyarı sırasında rauntun kalanını göstermeye devam eder (kullanıcı tek sayaç görür); yalnızca renk turuncuya döner ve yanıp söner.
- **Son 3 sn bip'i** raunt başlamadan önceki fazın (hazırlık/dinlenme) sonunda çalar. Raunt içinde son saniyeler için "tak-tak-tak" uyarısı var.
- **Son rauntun ardından** raunt sonu zili yerine "bitiş" zili (üç vuruş) çalar; dinlenme yok.
- **Atla:** hazırlık → raunt; raunt/uyarı → dinlenme (raunt sonu zili çalar); dinlenme → sonraki raunt (raunt başı zili çalar). Aradaki olaylar çalınmaz.
- **Ses planlama (önemli):** İlk sürümde ziller ekran karesinde çalınıyordu; tarayıcı önizlemesi gizliyken kareler durunca ziller kaçtı. Bu, telefonda takılma/düşük güç modunda da olabilir. Çözüm: `SoundScheduler` 1,2 sn ilerisindeki zilleri `AudioContext` saatine kurar; adımlar hem `requestAnimationFrame` hem 250 ms yedek aralıkla atılır. Duraklat/atla planlanmış sesleri iptal eder (`cancelScheduled`) ve yeniden planlar. 0,75 sn'den geç kalan zil çalınmaz (arka plandan dönüşte zil yağmuru olmasın). Birim testi: kareler 1 sn arayla gelse bile 18 zilin hepsi tam zamanında planlanıyor.
- **Ses seviyeleri:** zil sentezi çevrimdışı işlenip ölçüldü (OfflineAudioContext): ilk sürümde üst üste binen vuruşlar 1,13 tepe değerle kırpılıyordu, tak-tak 0,13 ile çok kısıktı. Seviyeler ayarlandı (tepe 0,35–0,76) ve ana çıkışa sınırlayıcı (compressor) eklendi.
- **Bitir uzun basış** 1,2 sn; onay `setTimeout` ile verilir (kare hızından bağımsız), dolum animasyonu yalnızca görsel. Parmak kayarsa iptal.
- **Antrenman sonu özeti dürüst:** erken bitirilirse planlanan değil gerçekleşen raunt ve çalışma süresi gösterilir (`engine.actual()`).
- **Ek ön ayarlar:** WAKO Ring 3×2/1, WAKO Tatami 2×2/1, Muay Thai amatör 3×3/1 (araştırma raporu). Tatami raunt sayısı disipline göre değişir; 2 raunt varsayıldı.
- **Son kullanılan ayar** IndexedDB'de (`kv: timer.last`), kurulum ekranı onunla açılır.
- **Masaüstü kısayolları:** Boşluk = duraklat/devam, → = atla (deneme kolaylığı).
- Haptik (F-109) iOS web'de yok (araştırma) → atlandı; faz geçişi tam ekran renk değişimiyle verilir.
- Kurulum ekranında son ayar IndexedDB'den asenkron gelir; çok yavaş cihazda ilk anda varsayılan ön ayar görünüp hemen güncellenir. Kabul edilebilir; gerekirse M10'da yükleme bitene dek BAŞLAT pasif yapılır.
- Önizleme tarayıcısında Wake Lock reddedildi (gömülü/gizli panel) → ekranda uyarı metni doğru göründü. iPhone 18.4+ ana ekran uygulamasında denenecek.

## M2: Ses motoru ve ekran
Plan:
1. 6 zil seti (Klasik, Gong, Ahşap Tak-Tak, Dijital Bip, Düdük, Sessiz), hepsi kodla üretilir.
2. Ayarlar deposu (IndexedDB `kv: settings`): zil seti, zil/koç ses düzeyi, müzik modu, otomatik duraklatma, faz parlaması.
3. Ses testi + kurtarma; müzik modu (Audio Session API).
4. Uygulamadan çıkınca duraklat, kilit ekranı/kulaklık kontrolleri (Media Session), faz parlaması.

Kararlar:
- **Ses kanalları:** zil ve koç sesi ayrı kazanç kanalları → ana kazanç → sınırlayıcı. Koç kanalı M3'te kullanılacak; kaydırıcı şimdiden ayarlarda.
- **Seviye dengesi:** her setin her sesi OfflineAudioContext ile işlenip ölçüldü; tepe değerler 0,45–0,76 aralığına getirildi (gong uyarısı 0,26, düdük 0,35, ahşap raunt sesleri 0,31–0,38 idi → yükseltildi). Kırpılma yok.
- **"Sessiz" seti** spec'te "sadece titreşim"; iOS web'de titreşim yok → "sadece ekran" (renk + parlama + sayaç).
- **Müzik modu:** "Müzikle karıştır" = `audioSession.type = 'ambient'` (varsayılan; müzik devam eder, sessiz anahtarı açıkken zil duyulmaz), "Her zaman duyulsun" = `'playback'` (sessiz anahtarı aşar, müziği durdurabilir). Spec'teki üçüncü mod ("çağrıda kıs") web'de mümkün değil (araştırma: Safari konuşma sırasında kendi kısar, kontrol edilemez). API yoksa ayarlar ekranında bilgi notu.
- **Ses testi iki katmanlı:** (1) Her BAŞLAT dokunuşunda motor açılır ve ses saatinin 0,3 sn'de ilerlediği doğrulanır (iOS 26 ana ekran hatası: motor "running" görünüp ilerlemeyebiliyor); başarısızsa antrenman ekranında uyarı + "Sesi tekrar dene" (dokunuşla yeniden açar) + sorun giderme listesi. (2) Ayarlar › Ses testi: zil çalar, "Duydun mu?"; Hayır → 4 adımlı sorun giderme (ses düzeyi, sessiz anahtar/müzik modu, uygulamayı kapat-aç, Safari'de aç). Hoparlörden ses çıkıp çıkmadığını yazılım ölçemez; bu yüzden kullanıcıya soruluyor.
- **Otomatik duraklatma** (varsayılan açık): `visibilitychange: hidden` veya `pagehide` → duraklat, planlı sesleri iptal et, ekranda "Uygulamadan çıktığın için duraklatıldı". Gerekçe: iOS web'de arka planda zamanlayıcı/ses güvenilir değil (WebKit 198277); sessizce kayan bir antrenman yerine açık duraklatma daha dürüst.
- **Media Session:** oynat/duraklat → duraklat/devam, ileri → atla; başlık "RAUNT · Raunt 2/5", alt satır kalan süre. iOS'ta yalnızca sayfa medya çalarken görünebilir; desteklenmezse sessizce atlanır. iPhone'da denenecek.
- **Faz parlaması:** faz değişiminde 0,45 sn beyaz parlama (uyarı fazı hariç; o zaten yanıp söner). `prefers-reduced-motion` açıksa animasyon çalışmaz, öğe görünmez kalır. Ayarlardan kapatılabilir.

## M3: Türkçe kombinasyon koçu
Plan:
1. `StanceMapper` + telaffuz kuralları + ortak kelime listesi (uygulama ve ses üretim betiği aynı listeyi kullanır).
2. Ses paketi: Windows'un Türkçe sesi (Microsoft Tolga) ile 59 klip, sessizlik kırpılmış (`scripts/generate-voice.mjs`).
3. `ComboScheduler` + çizelgeye çağrı olayları; ses ve ekran aynı çizelgeden.
4. Kombo kütüphanesi, kombo koçu kurulumu (Kombinasyon Koçu / Gölge Boks / Torba), antrenmanda kombo bandı.

Kararlar:
- **Klip birimi = hareket ifadesi** ("sol kroşe", "arka low kick"), cümle değil. Bir çağrı klipleri arka arkaya 0,25 sn arayla çalar (spec: 220–300 ms). 31 hareket × 2 duruş × 2 mod × 2 ad stili = 248 durum → 47 benzersiz ifade + 12 koç cümlesi = 59 klip, 1,09 MB, 16 kHz mono WAV.
- **Telaffuz:** ekranda "low kick", seste "lo kik" (`pronounce.ts`; seed'deki tts_pronunciations listesi + "check" → "çek", "stance" → "stens"). Klipler tarayıcıda değil önceden üretildiği için iPhone'un ses kalitesinden bağımsız. **Telaffuz kulakla doğrulanmadı** → iPhone test planına eklendi.
- **Klip süreleri manifestte** (`voiceManifest.json`); zamanlama bunlarla önceden hesaplanır, böylece çağrılar birbirine binmez. Cihaz sesi yedeğinde süre bilinmez; kaba tahmin kullanılır.
- **Ses kaynağı** ayarı: "Kayıtlı Türkçe ses" (varsayılan) / "Cihazın sesi". Klip yüklenemezse o çağrı otomatik cihaz sesine düşer; Türkçe cihaz sesi de yoksa uyarı + yalnızca ekranda yazı (spec M3 kabul 5).
- **Seçim kuralları** (spec §4.2.3): sıralı döngü; rastgele ağırlıklı, aynı kombo üst üste yok, son 3 tekrar yok, üst üste iki tekmeli kombo yok. Kurallar havuz küçükse sırayla gevşer (tek kombo havuzu takılmaz). Tekme kuralı yalnızca `kick` kategorisi (diz hariç).
- **Rastgele sıra tohumlu**: her BAŞLAT/Tekrar yeni tohum; aynı tohum aynı antrenmanı üretir (test edilebilirlik).
- **İlk çağrı** raunt zilinden 1,5 sn sonra; son çağrının uygulama penceresi raunt bitişini aşmaz. Rauntta sığmayan kombo sıralı modda bir sonraki rauntun ilk kombosu olur.
- **Hoca onayı kilidi** iki katmanlı: kombo bayrağı veya içindeki herhangi bir hareketin `coachApproval`'ı (kullanıcı kombolarında bayrak eksik olsa bile). Listede 🔒, seçim modunda devre dışı, havuzda yok.
- **Gölge Boks ve Torba** MVP'de kombo koçuyla aynı motor; fark başlık, açıklama ve varsayılan dinlenme (45 sn). Her modun kurulumu ayrı kaydedilir.
- **Kombo bandı:** konuşma sırasında koyu zeminle vurgulanır; pencere bitince bir sonraki çağrıya kadar soluk kalır; dinlenme/hazırlıkta "SIRADAKİ KOMBO" önizlemesi. Kod büyük ("1 · 2 · 3 · LKR"), altında her zaman isim modunda Türkçe adlar.
- **Ses doğrulaması (tarayıcı):** klip başlangıçları ölçüldü: 4 kelimelik çağrı, kelimeler arası tam 0,25 sn, ses saatine 1,2 sn önceden planlanmış, çakışma yok. (Not: `AudioBufferSourceNode.start` kendi prototipinde tanımlı; ilk ölçüm denemesi bu yüzden boş döndü.)
- **Lisans:** Microsoft Tolga sesi Windows'la gelen sistem sesi; üretilen klipler kişisel kullanım için. Uygulama mağazada/geniş çapta yayınlanırsa kendi sesin veya lisanslı ses kullanılmalı → `docs/SES_LISANSLARI.md`.

## Ses değişikliği: yapay zekâ antrenör sesi (19.11.2026)
- Kullanıcı Tolga sesini beğenmedi ("ses hiç olmamış"). Ölçümde iki hata da çıktı: kısa kelimeler 4-5 kat kısıktı ve kırpma kelime başını kesiyordu (düzeltildi, `da3f613`). Asıl sorun ses kalitesiydi.
- Seçenekler: kendi sesini kaydetmek, Piper (yalnız dfki sesi kaldı; fahrettin/fettah konuşmacı isteğiyle kaldırılmış, kullanılmadı), Higgsfield. Kullanıcı Higgsfield'ı seçti: "doğal ve gerçekçi antrenör sesi".
- **Üretim:** Higgsfield `text2speech_v2`, ElevenLabs motoru, erkek hazır ses "Callum"; 59 ifade, her biri ayrı istek, komut tonunda ("Sol kroşe!"), sakin cümleler noktayla ("Nefes al."). Maliyet ≈ 12 kredi. İngilizce terimler (low kick) olduğu gibi bırakıldı; ElevenLabs bunları doğal okuyor, Türkçe yazım hilesi (lo kik) gerekmedi.
- **İşleme** (`scripts/import-voice.mjs`): MP3 → WAV dönüşümü Windows'un yerleşik dönüştürücüsüyle (yeni bağımlılık yok), 48 kHz stereo → 24 kHz mono, zarf tabanlı kırpma (≥ 200 ms sessizlikten sonra gelen < 120 ms çıtırtılar atılır; "düz" klibinin sonunda böyle bir çıtırtı vardı, 1,13 sn → 0,62 sn), RMS eşitleme (0,127–0,14). 59 klip, 2,3 MB, kelime başına 0,36–0,6 sn.
- Tolga betiği `generate-voice-tolga.mjs` olarak yedekte; yanlışlıkla çalıştırılıp yeni sesi ezmesin diye yeniden adlandırıldı.
- Telaffuz yine kulakla doğrulanmadı (benim tarafımdan dinlenemiyor) → kullanıcı Ayarlar › Örnek dinle ile kontrol edecek. Kötü ifade olursa yalnızca o ifade yeniden üretilir (0,2 kredi).

## Tam Türkçe terimler (19.11.2026)
Kullanıcı: "uygulama full türkçe olsun". Spec §4.6'daki İngilizce terimler (jab, low kick, teep…) bırakıldı; ekran, ses ve kombo kodları tamamen Türkçe:
- Jab/cross → **sol direkt / sağ direkt** (artık duruşa göre adlandırılır: solak duruşta "sağ direkt" önde). "cab/düz" kaldırıldı.
- Teep → **ön/arka itme tekmesi**; low/middle/high kick → **alçak/orta/yüksek tekme**; slip → **kafa kaçır**; roll → **dalış**; parry → **savuştur**; check → **kalkan**; pivot → **dönüş**; stance değiştir → **duruş değiştir**; guard → **gard**.
- Orthodox/Southpaw → **Normal duruş (sol önde) / Solak duruş (sağ önde)** (iç kod değerleri aynı).
- Pad modu → **Lapa modu** (Türk salonlarında odak eldiveni "lapa").
- Ekrandaki kombo kodları ("1-2-3-LKR") yerine hareketlerin Türkçe kısa etiketleri: `moves.json` → yeni `shortTr` alanı ("1 · 2 · 3 · Arka alçak"). İç `code` alanı yalnızca kimlik/arama için kalır.
- 42 kombo adı ve açıklaması yeniden yazıldı; egzersiz/program metinlerinde guard, jab, teep, low kick, roundhouse, squat vb. Türkçeleştirildi (57 metin).
- Koruma testi: söylenen ifadelerde, hareket/kombo/egzersiz metinlerinde İngilizce terim kalırsa test başarısız olur.
- Ses paketi yeni ifadelerle (63) yeniden üretilmeli; o zamana kadar eksik klipler cihaz sesine düşer.
- **Ses yeniden üretildi (Türkçe terimlerle):** Kullanıcı, Callum'un (ElevenLabs, İngilizce ses) Türkçe kelimeleri İngilizce aksanla okuduğunu söyledi. Aynı cümle Marcus sesiyle MiniMax, Seed Audio, ElevenLabs v4 ve Seed Speech motorlarında karşılaştırıldı; kullanıcı **ElevenLabs v4**'ü seçti. 63 ifade bu motorla üretildi (≈13 kredi; ilk denemede 3 istek hız sınırına takıldı, 6'lı gruplarla sorunsuz). MiniMax'e gönderilen `language_boost: Turkish` parametresi Higgsfield tarafında dikkate alınmadı (yanıtta "auto" kaldı).
- **Rus aksanı sorunu ve klon (19.11.2026):** Marcus (hazır ses) Türkçeyi Rus/Doğu Avrupa aksanıyla okudu. Sebep: çok dilli modeller, sesin sahibinin ana dil aksanını taşır; Higgsfield'da ana dili Türkçe olan hazır ses yok. Çözüm: kullanıcı kendi sesinden kısa bir kayıt (OGG/Opus, ~25 sn) gönderdi → Higgsfield'a yüklendi → klon "Raunt Antrenör (Türkçe)" → ElevenLabs v4 (kullanıcı deneme klibinden v4'ü seçti) ile 63 ifade. Not: Windows'un yerleşik dönüştürücüsü OGG/Opus açamadı; dosya olduğu gibi yüklendi ve klonlama sorunsuz çalıştı.

## M4–M8 tamamlama (19.11.2026)
Kullanıcı: "uygulamayı tamamen bitir, dizayn modern olsun, onay almana gerek yok". Yapılanlar ve varsayımlar:
- **Kombo editörü** (S-07b): kategoriye göre hareket seç, sırala, dinle, kaydet (2–8 adım). Hoca onayı adımlardan türetilir. Kullanıcı komboları IndexedDB `userCombos`'ta; sistem kombolarıyla birlikte havuza girer (★ ile işaretli).
- **Paylaşım bağlantısı:** sunucu olmadığı için kombo adı ve adımları URL'ye kodlanır (`#/kombo/<ad|hareketler>`); açan kişide editör dolu gelir.
- **Refleks modu:** rastgele aralıkla (1–3 / 2–6 / 4–8 sn seçilebilir) tek hareket çağrısı; savunma payı %20; ayak çalışması hariç; kilitli hareketler hoca onayı yoksa çıkmaz.
- **Kurallı raundlar:** sadece yumruk, ön el, tekmesiz, gövdeye çalış, tekmeyle bitir, önce savunma; seçilenler raundlara sırayla dağıtılır ve raunt etiketi ekranda görünür. Kurala uyan kombo yoksa tüm havuz kullanılır (çağrısız raunt olmasın).
- **Raunt ortasında duruş değiştir:** koç "duruş değiştir" der, ikinci yarı ters duruşun sol/sağ adlarıyla çağrılır.
- **Lapa modu (Ek A):** SVG sahne; `padLayout.ts` saf fonksiyon ve birim testli (Ek A.3 tablosu). Solak duruşta ayna. Adımlar konuşma süresine eşit bölünerek sesle eş zamanlı yanar; yaklaşma halkası ve yükselme animasyonu; azaltılmış harekette yalnızca renk vurgusu. Dinlenmede sıradaki kombonun soluk önizlemesi. Varsayım: tekme lapası tarafı tekmenin bacağına göre (ön = sol, arka = sağ, normal duruş).
- **Rutinler:** Isınma (RAMP), Kondisyon devresi (2 set), Esneme: Antrenman sekmesinden önizleme sayfası + tek dokunuşla başlat; her hareket kendi süresiyle ve ekranda adıyla.
- **Antrenman ekranı:** iki grup (Kombinasyon ve vuruş / Rutinler), renkli simgeli kartlar (Apple Fitness / Strava tarzı).
- **Ayarlar:** Profilim (ad, kilo, haftalık hedef, antrenman saati, Ramazan modu, seri/rozet aç-kapa), alışkanlık planı, **Verilerim** (JSON yedek indir — iOS'ta Paylaş sayfası; yedekten geri yükle; karşılamayı tekrar göster; tüm verileri sil — uzun basışla), Güvenlik notları (sağlık, sarsıntı, bel).
- **Karşılama akışı (6 adım):** hoş geldin → sağlık notu onayı (zorunlu) → ad + duruş → haftalık hedef, saat, kilo → program başlangıç tarihi → eğer–o zaman ve engel planı.
- **Uygulama simgesi:** kullanıcının izniyle Higgsfield (GPT Image 2.6) ile üretildi; iki varyanttan zamanlayıcı halkalı eldiven seçildi. `scripts/make-icons.ps1` kaynak görselden 180/192/512 ve maskable PNG üretir (iOS SVG simge desteklemez). Kaynak: `assets/icon-source.png`.
- Not: Chromium'un yeni `scrollTo` sürümü Promise döndürüyor; `useEffect` içinde ok fonksiyonunun dönüş değeri olarak kullanılınca React çöktü → süslü parantezle düzeltildi.

## Uçtan uca kontrol ve geliştirmeler (19.11.2026)
Kullanıcı: "her şeyi baştan sona kontrol et, eksik/kötü görünen kalmasın, Fable'dan öneri al, geliştirmeleri direkt ekle".
- **Yöntem:** Tüm ekranlar telefon boyutunda tek tek gezildi. Bağımsız bir kod denetimi (15 bulgu) ve Fable'dan 13 geliştirme fikri alındı.
- **Fable'dan eklenenler:**
  - Koç araya girer: hazır ol, dinlen, son raunt, son on saniye ve raunt içinde gard/çene/nefes/omuz ipuçları. Ses paketinde olup hiç çalınmayan 12 klip kullanıldı, yeni kredi harcanmadı. Konuşmalar kombo çağrılarıyla çakışmaz; çakışan çağrı düşürülür.
  - Hocanın düzeltmesi: ders günlüğünde 4 hızlı seçim yapılır, ev antrenmanında o ipucu 3 kat sık söylenir. Bugün ekranında "Hocan dedi ki" görünür.
  - Kafaya darbe sorusu: evetse 2 gün boyunca sarsıntı uyarısı ve esneme önerisi gösterilir. Teşhis yok.
  - Devam ederken 3-2-1 sayılır.
  - Dinlenmede sıradaki kombonun "sık yapılan hata" maddesi gösterilir.
  - "Parça parça öğren": 1 ×4, 1-2 ×4, … sonra tam kombo, yavaş tempoda.
  - Program bitince yeni blok başlar: aynı şablon, raunt sayısı +1 (en fazla +2).
  - Ağrı ≥7 ya da üst üste zor günlerde "Bugün hafif çalış" düğmesi çıkar.
- **Kontrolde bulunan eksikler:**
  - Kombinasyon detayında "Bu kombinasyonu çalış" düğmesi yoktu.
  - Seans bölümlerinde gölge boks koçsuz başlıyordu; artık haftaya uygun seviyedeki kombinasyonlarla sesli koç var.
  - Kondisyon, ısınma ve soğuma bölümlerinde başlatma yoktu; hazır rutinlere bağlandı.
- **Denetim düzeltmeleri:**
  - Bölüm şeridi ve zincir desenlerinde kaçış karakteri kaybolmuştu ("Isınma" → "I").
  - Karşılama ve sağlık onayı artık paylaşım bağlantısıyla gelende de önce gösteriliyor.
  - Eski kullanıcı karşılamaya zorla sokulmuyor.
  - Yedek içe aktarma önce doğruluyor, tek işlemde yazıyor ve Türkçe hata veriyor.
  - iPhone'da yedek ve .ics için önce Paylaş sayfası açılıyor.
  - Editörde çift kayıt koruması var; paylaşım adında "|" sorunu giderildi.
  - Lapa modunda "duruş değiştir"den sonra lapa tarafı da değişiyor.
  - Kurulum yüklenirken yapılan seçim ezilmiyor.
  - Service worker bir önceki önbelleği bir sürüm daha saklıyor.
  - Safari ile ana ekran uygulamasının verisi ayrı olduğu için editöre "bağlantıyı yapıştır" eklendi.
- **Tasarım tutarlılığı:**
  - Kırmızı yalnızca başlat/vur için; kaydet düğmeleri mavi; seçimler nötr.
  - Süs emojileri ve "·" ile birleştirilmiş satırlar kaldırıldı.
  - Görünüm değişince sayfa başa dönüyor.
  - Hafta şeridindeki Paz/Cum kısaltma hatası düzeltildi.
- **Bilinçli olarak eklenmeyen Fable fikirleri:**
  - Hedef bölge çağrısı ve maç profili yeni klip ister.
  - Ritim raundu, ustalık defteri ve "hocama göster" kartı sonraki sürüme bırakıldı.
- Sürüm 1.0.0.


## 21.11.2026: Salon → ev köprüsü, unutma eğrisi, uyarlanan tempo, rakip saldırısı, teknik videosu

- **Hocanın kombinasyonu:** Ders günlüğünde isteğe bağlı 2–6 adımlık seçici (kombo editörünün hareket ızgarası, küçük). Kayıtta kullanıcı kombosu olur (açıklama "<tarih> dersinde hocanın gösterdiği kombinasyon."); kimliği ve ders tarihi kv `lesson.combo` içinde. Daha yeni bir dersin kombinasyonu eski tarihli bir günlükle ezilmez. Dersten sonraki 7 gün (ders günü dahil) ev günlerinde Bugün ekranında kart: "Parça parça öğren" (zincir, yavaş) ve "Bu kombinasyonu çalış". Kombo günlükten önce yazılır; kombo kaydedilemezse günlük de yazılmaz (tekrar denemede çift kayıt olmasın).
- **Unutma eğrisi:** kv `combo.stats` = { komboId: { count, lastDate } }. Antrenman özeti kaydedilince geçen süreye kadarki çağrılar sayılır; `chain:<id>:<n>` → `<id>`, `move:` ve `say:` sayılmaz. Ağırlık (rastgele seçim): hiç çağrılmamış 2, yoksa 1 + min(3, gün / 3); hocanın kombinasyonu 7 gün ×2. Sıralı seçimde ağırlık etkisizdir. Saf modül `src/core/engine/comboMemory.ts`, bellek deposu `src/core/records/comboMemoryStore.ts` (açılışta yüklenir). İkisi de kv'de olduğu için JSON yedeğine girer.
- **Uyarlanan tempo:** Koçlu antrenmanların özetinde "Tempo nasıldı?" (Rahattı / Tam iyiydi / Yetişemedim). Cevap, antrenman başındaki tempoya göre bir kademe değiştirir ve hemen kaydedilir; fikir değişince yeniden hesaplanır. Zincir antrenmanında sorulmaz (zincir hep yavaş).
- **Rakip saldırısı (lapa):** Kurulumda anahtar. `insertOpponentCalls` (saf, tohumlu) her rauntta yaklaşık 12–20 sn'de bir slip/block/roll/parry çağrısını boşluğa koyar (boşluk ≥ ifade + 1,5 sn). Hızlı ve usta tempoda çağrılar arası boşluk 1 sn'nin altında kaldığından savunma hiç sığmıyordu; savunma 3 sn'den fazla geciktiyse sıradaki kombo çağrısının yerine geçer. Çakışma yok, raunt sonunu aşmaz, hoca onayı kilidine uyar. Koçun sabit konuşmaları sonra eklenir ve kendileriyle çakışan çağrıları zaten ayıklar.
- **Teknik videom:** IndexedDB sürüm 2, yeni `videos` deposu (Blob). Bilerek `STORES` listesinde değil: JSON yedeği videoları içermez, arayüzde "Videolar yedeğe girmez" yazar. "Tüm verileri sil" videoları da siler. Kayıt türü sırası: mp4 (iOS Safari) → webm vp9 → vp8 → webm → tarayıcı varsayılanı. 3 sn geri sayım, 10 sn kayıt, ses yok. Karşılaştırma: eski klip solda, iki klip yan yana, aynalı, tek düğmeyle baştan birlikte. Şema 1 yedekleri yüklenmeye devam eder. Başka sekmede yeni sürüm açılırsa eski bağlantı kapanır (yükseltme takılmasın).
- **Doğrulanamayan:** Gerçek ön kamera ve MediaRecorder kaydı önizlemede açılamıyor (izin engelli; Türkçe izin mesajı göründü). Liste, silme ve karşılaştırma kanvastan üretilmiş webm kliplerle denendi. iPhone'da mp4 kaydı ve iki videonun birlikte oynaması cihazda denenmeli.
