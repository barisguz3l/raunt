# Raunt: Türkçe Kickboks Antrenman Uygulaması (Web / PWA)

Tamamen Türkçe, çevrimdışı, reklamsız, hesapsız kickboks koçu. iPhone'da Safari'den "Ana Ekrana Ekle" ile uygulama gibi çalışır.

## Özellikler
- **Bugün:** 3 haftalık başlangıç programı (Pzt/Çar/Cum salon + ev seansları), haftalık hedef halkası, seri, beslenme ve su zamanlaması, takvime ekle (.ics), ders günlüğü.
- **Antrenman:** Raunt zamanlayıcı, Kombinasyon koçu, Gölge boks, Torba, **Lapa modu** (ekranda yanan lapa), **Refleks**, Isınma, Kondisyon devresi, Esneme. Kurallı raundlar ve raunt ortasında duruş değiştirme.
- **Türkçe antrenör sesi:** önceden üretilmiş klipler (kullanıcının kendi sesinden klon), yedek olarak cihazın konuşma motoru; duruşa göre sol/sağ.
- **Ayna modu ve yapay zekâ koç:** ön kamera ayna; gard, el, çene uyarıları; algılanan vuruş ve hız; hayalet rakip; lapa avı; iskelet kaydı. Görüntü telefondan çıkmaz.
- **Kütüphane:** 31 hareket ve egzersiz (çöp adam animasyonu, adımlar, sık hatalar), 42 kombinasyon, kendi kombinasyonunu oluştur ve bağlantıyla paylaş, sözlük.
- **İlerleme:** haftalık yük (sRPE), başlangıç/final testleri, ölçüler, kuşak yolculuğu, geçmiş.
- **Ayarlar:** profil, duruş, ses, alışkanlık planı, JSON yedek ve geri yükleme.

- Web planı (güncel): [docs/PLAN.md](docs/PLAN.md)
- Kararlar: [docs/KARARLAR.md](docs/KARARLAR.md)

## Geliştirme
Gerekli: Node.js 20+.

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

```bash
npm run build
```

`npm run preview` derlenmiş sürümü (service worker dahil) http://localhost:4173 adresinde açar.

## Klasörler
| Yol | İçerik |
|---|---|
| `seed/` | Statik içerik (hareketler, kombolar, program, testler) — tek kaynak |
| `src/core/` | UI'dan bağımsız mantık: içerik, motor (çizelge, saat, kombo zamanlayıcı), ses, program, kayıtlar, kalıcılık |
| `src/features/` | Ekranlar (Bugün, Antrenman, Kütüphane, İlerleme, Ayarlar, Lapa, Karşılama) |
| `public/voice/` | Türkçe antrenör ses klipleri |
| `scripts/` | Ses içe aktarma, simge üretimi |
| `src/design/` | Renkler, büyük butonlar, ikonlar |
| `src/i18n/tr.ts` | Tüm Türkçe metinler |
| `build/` | Service worker üretimi |

## Yayın (GitHub Pages)
`main` dalına her gönderimde [.github/workflows/pages.yml](.github/workflows/pages.yml) testleri çalıştırır, uygulamayı derler ve GitHub Pages'e yayınlar. İlk kurulumda depoda **Settings › Pages › Source: GitHub Actions** seçilmelidir.

## iPhone'a kurulum
1. iPhone'da **Safari** ile uygulamanın adresini aç (`https://<kullanıcı-adı>.github.io/<depo>/`).
2. Alttaki **Paylaş** düğmesi › **Ana Ekrana Ekle** › **Ekle**.
3. Ana ekrandaki **Raunt** simgesinden aç. İlk açılıştan sonra internet olmadan da çalışır.
4. **Ayarlar › Ses › Ses testi** ile zilin duyulduğunu kontrol et.

Güncelleme: yeni sürüm yayınlanınca uygulamayı kapatıp iki kez açmak yeterli (ilk açılışta yeni sürüm indirilir, ikincisinde devreye girer).

Notlar:
- Ekranın açık kalması için iOS 18.4 veya üstü gerekir.
- Antrenman sırasında ekranı kilitleme ve uygulamadan çıkma; çıkarsan antrenman duraklar.
- Veriler yalnızca bu telefonda. Safari'deki veriler ana ekran uygulamasına taşınmaz.
