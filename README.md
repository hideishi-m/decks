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
