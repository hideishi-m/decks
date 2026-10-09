# 決めたことの記録（ADR）

変えると壊れる約束と、入れないと決めたことを、1 件 1 ファイルで残す。
理由を残すのは、後から「冗長だ」「足りない」と見えたときに、同じ議論を繰り返さないため。

## 書き方

- ファイル名は `NNNN-<英語の短い名前>.md`。番号は連番で、使い回さない。
- 見出しは `# N. 決めたこと`。続けて日付と状態、`## 背景`・`## 決定`・`## 結果` を書く。
- 状態は「採用」か「置き換え（ADR N）」。覆すときは本文を書き換えず、新しい ADR を足して、
  古い方の状態だけを「置き換え（ADR N）」にする。

## 一覧

| ADR | 決めたこと | 状態 |
|---|---|---|
| [1](0001-endpoint-tiers.md) | エンドポイントを 3 層に分け、管理面は前段で守る | 採用 |
| [2](0002-check-seats-after-auth.md) | 席とカードの存在は認証の後で確かめる | 採用 |
| [3](0003-hide-face-down-cards.md) | 伏せた札の中身は、見てよい人にしか返さない | 採用 |
| [4](0004-token-uid-no-gid-reuse.md) | トークンに卓ごとの uid を入れ、gid を再利用しない | 採用 |
| [5](0005-websocket-delivery.md) | WebSocket は接続ごとに配り、action に卓を丸ごと載せる | 採用 |
| [6](0006-close-connections-on-shutdown.md) | 終了時に、要求の途中の接続も切る | 採用 |
| [7](0007-persist-on-shutdown.md) | 卓は終了時にだけ保存し、読めなければ起動しない | 採用 |
| [8](0008-no-runtime-dirs.md) | `data/` と `logs/` を実行時に作らない | 採用 |
| [9](0009-delete-games-manually.md) | 卓は管理画面の DELETE で消す | 採用 |
| [10](0010-mode-required.md) | 卓の種類（mode）は必須にし、既定値を持たない | 採用 |
| [11](0011-title-fixed-at-creation.md) | 卓の名前は作るときにだけ決める | 採用 |
| [12](0012-no-reveal.md) | 手札をめくって見せる操作を入れない | 採用 |
| [13](0013-list-games-by-id.md) | 卓の一覧は gid だけを返す | 採用 |
| [14](0014-keep-express4-eslint9.md) | express 4 と eslint 9 を維持する | 採用 |
| [15](0015-websocket-docs-in-swagger.md) | WebSocket の説明は swagger の説明文と README に置く | 採用 |
