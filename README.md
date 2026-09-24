# Rojak DriveK1t

## Struktur

```text
rojak-drive-k1t/
├── index.html
├── admin.html
├── firebase-config.js
├── firestore.rules
├── package.json
├── README.md
└── api/
    └── music.js
```

## Vercel Environment Variables

```text
GITHUB_TOKEN              Secret
GITHUB_OWNER              Config
GITHUB_REPO               Config
GITHUB_BRANCH             Config
FIREBASE_SERVICE_ACCOUNT  Secret
```

## Nilai
GITHUB_OWNER = King-Rojak
GITHUB_REPO = rojak-drive-k1t
GITHUB_BRANCH = main

FIREBASE_SERVICE_ACCOUNT = seluruh isi JSON service account Firebase.

## GitHub token
Fine-grained token untuk repository `King-Rojak/rojak-drive-k1t` dengan `Contents: Read and write`.

## Firebase
Aktifkan Google Authentication dan Firestore. Deploy `firestore.rules`. Setelah akun pertama login, ubah `users/{UID}.role` menjadi `admin`.

## Music
Admin mengisi judul, artist, MP3, dan cover. MP3/cover masuk GitHub melalui `/api/music`; metadata masuk collection Firestore `music`.
