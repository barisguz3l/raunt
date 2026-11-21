# Ses lisansları

| Ses | Kaynak | Lisans / not |
|---|---|---|
| Zil setleri (Klasik, Gong, Ahşap Tak-Tak, Dijital Bip, Düdük) | Web Audio ile kodla üretilir (`src/core/audio/bells.ts`) | Projeye ait; dosya yok, kopyalanmış ses yok |
| Türkçe antrenör sesi (`public/voice/*.wav`, 63 klip) | **Kullanıcının kendi Türkçe ses kaydından** Higgsfield üzerinde oluşturulan klon ("Raunt Antrenör (Türkçe)"), **ElevenLabs v4** ile üretildi (19.11.2026, ~13 kredi + klonlama). Metinler `scripts/voice-prompts.json` | Ses kullanıcıya ait; kullanıcının kendi kaydı ve onayıyla klonlandı. Higgsfield/ElevenLabs kullanım koşulları geçerli |
| Eski Türkçe ses (yedek betik) | Windows'un Microsoft Tolga sesi, `scripts/generate-voice-tolga.mjs` | Kullanılmıyor; kalitesi düşük bulundu. Yalnızca acil yedek |
| Cihazın sesi (yedek) | Telefonun konuşma motoru (Web Speech API) | Dosya üretilmez, cihazda okunur |

Rakip uygulamaların zil veya seslendirmeleri kullanılmadı (spec §9).

## Ses paketini yeniden üretmek
1. `scripts/voice-prompts.json`'daki her metni aynı ses ve motorla üret (dosya adı = `id`, MP3).
2. MP3'leri bir klasöre koy ve içe aktar (yalnızca Windows; dönüştürme Windows'un yerleşik Media Foundation'ı ile):

```bash
node scripts/import-voice.mjs <mp3-klasörü> "Higgsfield · ElevenLabs v4 · Marcus (yapay zekâ)"
```

Betik eksik ifade varsa durur; 24 kHz tek kanala çevirir, baş/sondaki sessizliği ve çıtırtıları kırpar, ses seviyesini eşitler ve `voiceManifest.json`'u yazar. Yeni hareket veya koç cümlesi eklenince önce `src/core/speech/vocabulary.ts` güncellenir. Test (`CoachWorkout.test.tsx`) çizelgedeki her ifadenin klibi olduğunu doğrular.
