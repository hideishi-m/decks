# 15. WebSocket の説明は swagger の説明文と README に置く

- 日付: 2026-09-17
- 状態: 採用

## 背景

OpenAPI は 3.2 でも WebSocket を書けない（3.2 で増えたのは SSE などの、1 つの応答で続けて届く形式）。
WebSocket を書ける AsyncAPI は Redoc 3 が表示できるが、`public/spec.html` を作る `redocly build-docs` は
まだ Redoc 2 で、OpenAPI 3.0 / 3.1 しか受け付けない。

## 決定

swagger の `websocket` タグの説明文と `ActionMessage` スキーマ、README の「WebSocket」の節に書く。

## 結果

- `redocly build-docs` が Redoc 3 に切り替わって AsyncAPI を受け付けるようになったら、
  `asyncapi.yaml` へ移すかを改めて決める。
