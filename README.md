# トランプデッキAPI

## 約束事

`/version`、`/token`、ゲームの一覧・作成・取得を除く全てのエンドポイントは
`Authorization: Bearer <token>` を要求する。トークンは gid と pid に紐づいていて、
`:gid` と `:pid` がトークンの中身と一致しないと 403 を返す。

`card` は次の形。

トランプ: {
  suit: "S",
  rank: "A",
  deck: 0
}

タロット: {
  rank: "4",
  position: "U"
}

suit は C / D / H / S / X（X はジョーカー）。
rank は A / 2〜9 / 0（10）/ J / Q / K / X（X はジョーカー）。
position は U（正位置）/ R（逆位置）。

pid は 0 がマスターで、1 以降がゲーム作成時に渡した players の並び順。


## バージョン

### バージョン取得

GET /version

response: { version: "1.6.0" }


## 認証

### トークン取得

POST /token

request: {
  gid: "1",
  pid: "0"
}

response: { token: "..." }


## ゲーム

### 新規ゲーム作成

POST /games

request: {
  players: [ "pc1", "pc2", "pc3" ],
  tarots: [ "4", "18", "7" ]
}

response: { gid: "1" }

### ゲーム一覧

GET /games

response: { games: [ { gid: "1" }, { gid: "2" } ] }

### ゲーム取得

GET /games/:gid

response: {
  gid: "1",
  players: [ "マスター", "pc1", "pc2", "pc3" ]
}

### ゲーム終了

DELETE /games/:gid

response: { gid: "1" }


## 卓

### 卓

全席の公開状態を1回で取得する。伏せられている札は枚数だけを返し、中身は返さない。
自分の手札は「手札一覧」で取る。

GET /games/:gid/table

response: {
  gid: "1",
  seats: [
    {
      pid: "0",
      player: "マスター",
      hand: { length: 4 },
      tarot: { length: 0 }
    }
  ],
  deck: { length: 90 },
  pile: {
    length: 1,
    card: card
  },
  tarotDeck: { length: 25 },
  tarotPile: {
    length: 1,
    card: card
  }
}


## 山札

### 山札

GET /games/:gid/deck

response: {
  gid: "1",
  deck: { length: 108 }
}

### 山札をめくる

山札の一番上を捨て札にする。

PUT /games/:gid/deck/discard

response: {
  gid: "1",
  deck: { length: 107 },
  pile: {
    length: 1,
    card: card
  }
}

### 捨て札を山札に戻す

捨て札の一番上を山札の一番上に戻す。

PUT /games/:gid/deck/recycle

response: {
  gid: "1",
  deck: { length: 108 },
  pile: { length: 0 }
}


## 捨て札

### 捨て札

GET /games/:gid/pile

response: {
  gid: "1",
  pile: {
    length: 1,
    card: card
  }
}

### 捨て札を全て山札に戻す

戻したあと山札を切る。

PUT /games/:gid/pile/shuffle

response: {
  gid: "1",
  deck: { length: 108 },
  pile: { length: 0 }
}


## 手札

### 手札一覧

自分の pid しか取得できない。

GET /games/:gid/players/:pid

response: {
  gid: "1",
  pid: "1",
  player: "pc1",
  hand: {
    length: 4,
    cards: [ array of card ]
  }
}

### 山札から引く

PUT /games/:gid/players/:pid/draw

response: {
  gid: "1",
  pid: "1",
  player: "pc1",
  deck: { length: 107 },
  hand: {
    length: 5,
    cards: [ array of card ]
  }
}

### 捨て札から戻す

捨て札の一番上を手札に加える。

PUT /games/:gid/players/:pid/recycle

response: {
  gid: "1",
  pid: "1",
  player: "pc1",
  pile: { length: 0 },
  hand: {
    length: 5,
    cards: [ array of card ]
  }
}

### 手札取得

GET /games/:gid/players/:pid/cards/:cid

response: {
  gid: "1",
  pid: "1",
  player: "pc1",
  cid: "1",
  card: card
}

### 捨て札にする

PUT /games/:gid/players/:pid/cards/:cid/discard

response: {
  gid: "1",
  pid: "1",
  player: "pc1",
  pile: {
    length: 1,
    card: card
  },
  hand: {
    length: 3,
    cards: [ array of card ]
  }
}

### 手札を別のプレーヤーに渡す

PUT /games/:gid/players/:pid/cards/:cid/pass/:tid

response: {
  gid: "1",
  pid: "1",
  player: "pc1",
  hand: {
    length: 3,
    cards: [ array of card ]
  }
}

### 別のプレーヤーから手札を引く

相手の手札から1枚を無作為に抜く。位置は指定できない。

PUT /games/:gid/players/:pid/pick/:tid

response: {
  gid: "1",
  pid: "1",
  player: "pc1",
  hand: {
    length: 5,
    cards: [ array of card ]
  }
}


## タロット山札

### タロット山札

GET /games/:gid/tarot/deck

response: {
  gid: "1",
  deck: { length: 25 }
}

### タロットをめくる

タロット山札の一番上をタロット捨て札にする。

PUT /games/:gid/tarot/deck/discard

response: {
  gid: "1",
  deck: { length: 24 },
  pile: {
    length: 1,
    card: card
  }
}


## タロット捨て札

### タロット捨て札

GET /games/:gid/tarot/pile

response: {
  gid: "1",
  pile: {
    length: 1,
    card: card
  }
}

### タロット捨て札を反転する

一番上の正位置と逆位置を入れ替える。

PUT /games/:gid/tarot/pile/flip

response: {
  gid: "1",
  pile: {
    length: 1,
    card: card
  }
}


## タロット切り札

### 切り札

自分の pid しか取得できない。マスターは切り札を持たないので length は 0。

GET /games/:gid/tarot/players/:pid

response: {
  gid: "1",
  pid: "1",
  player: "pc1",
  hand: {
    length: 1,
    card: card
  }
}

### 捨て札にする

PUT /games/:gid/tarot/players/:pid/discard

response: {
  gid: "1",
  pid: "1",
  player: "pc1",
  pile: {
    length: 1,
    card: card
  },
  hand: { length: 0 }
}


## WebSocket

ページと同じパスへ接続し、最初に gid / pid / token を送る。検証に通らなければ切断される。

send: {
  gid: "1",
  pid: "0",
  token: "..."
}

以降、そのゲームの操作が1つにつき1通流れてくる。自分の操作も返ってくる。
table は「卓」と同じ内容なので、受け取った側は改めて取得せずに描き直せる。

receive: {
  action: {
    seq: 4,
    at: "2026-09-16T02:42:29.306Z",
    type: "pass",
    gid: "1",
    pid: "1",
    player: "pc1",
    tid: "2",
    target: "pc2",
    card: null,
    table: table
  }
}

- seq はゲームごとに 1 から増える。飛んでいたら取りこぼしなので「卓」を取り直す。
- 繋ぎ直したときも「卓」を取り直す。切れている間の操作は送り直されない。
- tid と target は pass と pick のときだけ入る。それ以外は null。
- card は場に表で出た札だけ。伏せたままのときは null。
- table は「卓」の応答から gid を除いたもの。

type と、そのとき card に入るもの。

| type | 操作 | card |
|---|---|---|
| draw | 山札から引く | null |
| discard | 手札を捨て札にする | 捨てた札 |
| recycle | 捨て札を手札に戻す | 戻した札 |
| pass | 手札を別のプレーヤーに渡す | null |
| pick | 別のプレーヤーから手札を引く | null |
| deck-discard | 山札をめくる | めくれた札 |
| deck-recycle | 捨て札を山札に戻す | null |
| shuffle | 捨て札を全て山札に戻す | null |
| tarot-deck-discard | タロットをめくる | めくれた札 |
| tarot-discard | 切り札を捨て札にする | 捨てた札 |
| tarot-flip | タロット捨て札を反転する | 反転後の札 |

空文字列は生存確認に使う。受け取ったらそのまま返す。


## デバッグ

### ダンプ

ゲームの全ての札をサーバのログへ出す。応答には含まれない。

PUT /games/:gid/dump

response: { gid: "1" }


## エラー

response: {
  error: {
    message: "game not found for gid",
    cause: { gid: "9" }
  }
}

- 400 パスやリクエストの形式が不正
- 401 トークンが無い、または検証できない
- 403 トークンの gid / pid がパスと一致しない
- 404 gid / pid / cid に対応するものが無い
