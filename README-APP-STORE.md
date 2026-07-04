# Ineffable — Play Store & App Store Yayınlama Rehberi

Bu proje zaten bir PWA (web app). Bu rehber onu **gerçek Android/iOS uygulamasına**
çevirip mağazalara yüklemeni sağlar. Kullanacağımız araç: **Capacitor**
(web kodunu native bir kabuğa saran, Ionic'in ücretsiz aracı).

---

## Gereksinimler

| Platform | İhtiyacın olan |
|---|---|
| Android | Node.js + Android Studio (Windows/Mac/Linux, hepsi olur) |
| iOS | **Mutlaka Mac** + Xcode (Apple'ın kuralı — Windows'ta iOS derlenemez) |

Mac'in yoksa: Android'i kendi bilgisayarında yapıp, iOS için ya bir Mac
ödünç al, ya da bulut Mac servisi kullan (örn. MacinCloud, GitHub Actions
macOS runner).

---

## 1. Kurulum (bir kere yapılır)

Terminali proje klasöründe aç (bu zip'in içinde) ve sırasıyla çalıştır:

```bash
npm install
npx cap init
```

`npx cap init` sorularını şöyle cevapla (ya da Enter'a basıp `capacitor.config.json`
içindeki hazır değerleri kullan):
- App name: `Ineffable`
- App ID: `com.ineffable.app`
- Web dir: `.`

---

## 2. Android projesi oluştur

```bash
npx cap add android
npx cap copy
npx cap open android
```

Son komut Android Studio'yu açar.

1. Android Studio'da sağ üstte **Build → Generate Signed Bundle / APK**
2. **Android App Bundle (.aab)** seç (Play Store bunu ister)
3. "Create new key store" ile bir imzalama anahtarı oluştur — **bu dosyayı ve
   şifreni kaybetme**, gelecekteki güncellemeler için lazım olacak
4. Release modunda derle → `.aab` dosyası çıkar

### Play Store'a yükleme
1. [play.google.com/console](https://play.google.com/console) → **Google Play
   Console** hesabı aç (tek seferlik **25 $** geliştirici ücreti)
2. "Create app" → uygulama adı, kategori (Eğitim), açıklama, ekran görüntüleri gir
3. "Production" → "Create release" → `.aab` dosyasını yükle
4. İnceleme için gönder (genelde birkaç saat–birkaç gün sürer)

---

## 3. iOS projesi oluştur (Mac gerekli)

```bash
npx cap add ios
npx cap copy
npx cap open ios
```

Son komut Xcode'u açar.

1. Xcode'da sol üstte proje adına tıkla → **Signing & Capabilities**
2. "Team" olarak Apple Developer hesabını seç (henüz yoksa aşağıda anlatılıyor)
3. Üst menüden **Product → Archive**
4. Archive tamamlanınca açılan pencereden **Distribute App → App Store Connect**

### App Store'a yükleme
1. [developer.apple.com](https://developer.apple.com) → **Apple Developer
   Program**'a kaydol (**99 $/yıl**)
2. [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → "My Apps"
   → "+" → yeni app oluştur (aynı bundle ID: `com.ineffable.app`)
3. Xcode'dan gönderdiğin build birkaç dakika içinde burada görünür
4. Ekran görüntüleri, açıklama, kategori (Education) gir → "Submit for Review"
5. Apple incelemesi genelde 1–3 gün sürer

---

## 4. İçerik güncellemesi yapmak istersen

`grammar.js` içine yeni ders eklemek yeterli — native tarafı tekrar kurmana
gerek yok, sadece:

```bash
npx cap copy
```

çalıştırıp Android Studio / Xcode'dan tekrar build alman yeterli.

---

## Özet — hangi komut ne işe yarar

| Komut | Ne yapar |
|---|---|
| `npx cap add android` / `ios` | Native proje klasörünü oluşturur (bir kere) |
| `npx cap copy` | Web dosyalarını (html/css/js) native projeye kopyalar |
| `npx cap open android` / `ios` | Android Studio / Xcode'u açar |

---

## Notlar

- Uygulama ikonların (`icons/icon-192.png`, `icons/icon-512.png`) zaten hazır,
  ama mağaza gereksinimleri için Android Studio ve Xcode kendi ikon
  boyutlarını (adaptive icon, farklı çözünürlükler) otomatik senden isteyecek —
  bu ikonları kaynak olarak kullanabilirsin.
- Play Store incelemesi App Store'dan genelde daha hızlı ve daha az katıdır.
- İkisi de yayına girdikten sonra güncellemeler için sadece yukarıdaki
  "İçerik güncellemesi" adımını tekrarlarsın.
