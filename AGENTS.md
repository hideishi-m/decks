# decks の開発規約

TOKYO NIGHTMARE / LAST REQUIEM を遊ぶための卓（カードデッキ）アプリ。Node 22・Express 4・ws の
ネイティブ ESM で、ビルド工程は無い。

このファイルに書くのは、どの環境でも成り立つコードの書き方だけにする。
起動の仕方や手元の環境の都合（シェル、コンテナ、絶対パス）は書かない。

**変えると壊れる約束と、入れないと決めたことは [adr/](adr/README.md) にある。** 該当する箇所を
触る前に読み、覆すときは新しい ADR を足す。

## 1. 構成

| ファイル | 役割 |
|---|---|
| `index.mjs` | 起動とシグナル。SIGTERM / SIGINT / SIGHUP で `emitter` に `close` を流す |
| `args.mjs` | コマンドラインの解析 |
| `server.mjs` | HTTP(S) と WebSocket。action を卓ごとに配る |
| `app.mjs` | Express のルート、入力検証、認証（ticket / token）、卓の保存と復元 |
| `game.mjs` / `card.mjs` | 卓と札のモデル。HTTP を知らない |
| `store.mjs` | `data/games.json` の読み書き |
| `public/` | 参加者の画面（`play.html`）と管理画面（`admin.html`）。ブラウザでそのまま動く |
| `test/` | `node:test` のテスト |
| `adr/` | 決めたことの記録 |

- `public/js/` の `attr.js`・`TNM_tarot.js`・`LRQ_epitaph.js`・`common.js` はサーバからも import する。
  ブラウザ専用の API（`document` など）を、これらの最上位で触らない。
- 外部の CDN と web フォントは使わない。書体はシステムのものだけにする。
- タロットとエピタフの画像（`public/images/TNM_tarot`・`public/images/LRQ_epitaph`）は版権物なので、
  リポジトリにも配布物にも含めない（`.gitignore` 済み）。

## 2. 書き方

- インデントはタブ、文字列は単引用符、文末にセミコロン。
- 比較は `===` / `!==` だけを使い、定数を左に置く（`undefined === game`、`'tarot' === mode`）。
  否定の `!` の代わりに `false === re.test(value)` と書く。
- 既定値は `??` で入れる。そのため `null` に意味を持たせない（`??` が省略と同じに扱う）。
- コメント・テスト名・README は日本語、swagger は英語。コメントには理由と契約を書き、
  その時点のコードの様子は書かない。
- 絵文字を書かない（コード、コメント、テスト名、CSS、README、swagger、ADR のどれにも）。
- CSS のコメントは 1 行にする。
- JS・CSS・テストの先頭には BSD-3-Clause の著作権表示を置く（年は `2022-<今年>`）。
- 利用者が入力した文字列（席名、卓の名前）は `el()` か `textContent` で入れる。
  `fromHtml()` のテンプレートに埋め込まない。
- 表示と非表示は `hidden` 属性で切り替える（`app.css` の `[hidden]` が `display` に勝つ）。
- 色と字面のトークンは `app.css` に集める。卓の種類ごとの見た目は `mode-tarot.css` / `mode-epitaph.css` の
  `[data-mode="…"]` に閉じる。ユーティリティのクラスに地色を持たせない。
- 入力は検査して 400 を返す。express と body-parser が付けた 4xx（壊れた JSON、413 など）は 500 にしない。

## 3. テスト

- `npm test` で全件を回す。`store.mjs` を差し替えるのに `--experimental-test-module-mocks` が要るので、
  1 ファイルだけ回すときもこのフラグを付ける。
- `app.test.mjs` は `createApp()` を port 0 で起こして `fetch` で叩く（supertest は使わない）。
  `server.test.mjs` は WebSocket、`common.test.mjs` は jsdom で `common.js` を見る。
- テストはリポジトリの `data/` と `logs/` を使わない。保存先は `mock.module` で一時ディレクトリへ向け、
  ログは `access.log-*` だけを消す（`.gitkeep` を消さない）。
- 不具合を直したら、直す前の実装で落ちるテストを足し、修正を外すと落ちることを確かめる。
- 足した行と分岐はテストで通す。`play.js` と `admin.js` にはテストが無いので、ブラウザで確かめる。
- lint は `npx eslint .`（eslint 本体は devDependencies に無い）。

## 4. 文書と依存

- API を変えたら `README.md` と `swagger.yaml` の両方を直す。`public/spec.html` は `npm run redocly` で
  作る生成物なので、手で直さない。
- 依存は `npm install`（開発用は `-D`）で足し、`package.json` の版を手で書かない。
  `package-lock.json` はリポジトリに入れない。

## 5. コミット

- 1 行で、`Mod: ...` か `Fix: ...` の英文にし、ピリオドで終える。
