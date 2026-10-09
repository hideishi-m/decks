# 14. express 4 と eslint 9 を維持する

- 日付: 2026-09-16（2026-09-17 に測り直し）
- 状態: 採用

## 背景

express 5 と eslint 10 が出ている。

## 決定

どちらも今の版のままにする。上げられないのではなく、上げる必要が無いので上げない。

## 結果

- 実測では、どちらもそのまま動く。express 5 でもテストは全件通り、ルートは `:param` だけなので
  path-to-regexp 8 の影響を受けない。違いは express が返す静的ファイルの Content-Type
  （`application/javascript` から `text/javascript`）だけだった。eslint 10 も設定を変えずに指摘は無い。
- 必要になったら、測り直さずに上げてよい。
