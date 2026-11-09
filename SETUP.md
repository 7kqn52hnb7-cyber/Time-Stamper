# Time Stamper セットアップ手順

## 1. Firebase プロジェクトを作る（約10分）

1. https://console.firebase.google.com/ を開いて Google アカウントでログイン
2. 「プロジェクトを作成」→ 名前は `time-stamper`（なんでもOK）
   - Google アナリティクスは「無効」でOK
3. 左メニュー「構築」→ **Authentication** →「始める」
   - 「ログイン方法」タブ → **Google** を有効にして保存
4. 左メニュー「構築」→ **Firestore Database** →「データベースを作成」
   - ロケーション：`asia-northeast1（東京）`
   - 「本番環境モード」で開始
   - 作成後「ルール」タブを開き、このフォルダの `firestore.rules` の中身に置き換えて「公開」
5. 左上の歯車 →「プロジェクトの設定」→ 下の「マイアプリ」で **`</>`（ウェブ）** を押す
   - アプリ名：`Time Stamper`（Firebase Hosting はチェック不要）
   - 表示された `firebaseConfig = { ... }` の中身をコピーして Claude に渡す

## 2. 公開（GitHub Pages）

1. Claude が GitHub にアップロード
2. GitHub のリポジトリ →「Settings」→「Pages」→ Branch を `main` / `/(root)` にして Save
3. 数分後に `https://<ユーザー名>.github.io/time-stamper/` で開ける
4. Firebase コンソール → Authentication →「設定」→「承認済みドメイン」に `<ユーザー名>.github.io` を追加

## 3. iPhone に入れる

1. iPhone の **Safari** で上の URL を開く
2. 共有ボタン →「ホーム画面に追加」
3. ホーム画面のアイコンから開いて Google でログイン
   - ※ホーム画面版と Safari 版はログインが別なので、ホーム画面版でログインしてください

## 4. PC で見る

- Chrome や Edge で同じ URL を開いて、同じ Google アカウントでログイン

## メモ

- 記録データは Firebase（Google のサーバー）の「自分専用の場所」に保存されます。ほかの人には見えません
- `firebase-config.js` が空のときは「ローカルモード」（その端末だけに保存）で動きます
