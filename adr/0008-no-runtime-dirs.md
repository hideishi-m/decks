# 8. `data/` と `logs/` を実行時に作らない

- 日付: 2026-09-16（`data/` は 2026-09-17）
- 状態: 採用

## 背景

アクセスログの置き場（`logs/`）を、起動時にアプリが作っていた。

## 決定

追跡した `.gitkeep` で、clone した時点から `data/` と `logs/` が在るようにする。次の 3 か所で残す。

- `.gitignore`（`/data/*` と `!/data/.gitkeep`、`/logs/*` と `!/logs/.gitkeep`）
- `package.json` の `files`
- `Dockerfile` の `COPY . .`（`.dockerignore` は `.git` と `node_modules` だけ）

## 結果

- どれかが欠けると、エラーも出ずに、アクセスログや卓の保存だけが無くなる。
  テスト（「アクセスログが logs/ に開いている」）が `logs/.gitkeep` の存在を確かめている。
- テストは `logs/` を消さず、`access.log-*` だけを消す。`data/` は使わない（ADR 7）。
