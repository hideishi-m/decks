# トランプデッキAPI

## 約束事

エンドポイントは 3 つの層に分かれる。

| 層 | エンドポイント | 要求するもの |
|---|---|---|
| 管理 | `/version`、`GET /games`、`POST /games`、`GET /games/:gid`、`DELETE /games/:gid` | なし |
| 入場 | `GET /join`、`POST /token` | `Authorization: Ticket <ticket>` |
| 卓の中 | それ以外すべて | `Authorization: Bearer <token>` |

**ticket** は卓への入場券。卓を作ったときに 1 つだけ発行され、以後は再発行されない。
これを知っている人だけが席のトークンを取れる。卓を消すと通らなくなる。

**token** は席の権限。gid と pid に紐づいていて、`:gid` と `:pid` が
トークンの中身と一致しないと 403 を返す。有効期限は 1 日。
卓ごとの識別子も入っていて、同じ gid で作り直された卓では 401 になる。

管理層には認証が無い。`POST /games` と `GET /games/:gid` は ticket と伏せたエピタフの中身を返すので、
**前段（nginx 等）で管理層と `admin.html` を保護すること。** 覆うのは次の 4 つだけ。

    /admin.html
    /js/admin.js
    /games
    /games/<数字>

**`/games/<数字>` より深いパスは覆わないこと。** `/games/1/table` や
`/games/1/players/2` は参加者が使うので、`/games` 以下をまとめて覆うと
参加者が締め出される。nginx なら末尾を `$` で止める。

    location ~ ^/decks/(admin\.html|js/admin\.js|games(/[0-9]+)?)$ {
        auth_basic "decks admin";
        auth_basic_user_file /etc/nginx/.htpasswd-decks;
        # location ~ は location ^~ /decks より優先されるので、
        # root と try_files をここにも書く。
    }

同じ卓の中では、ticket があればどの席のトークンも取れる。
卓の中で席を偽れないようにはなっていない。

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


## 卓の保存

卓は起動時に `data/games.json` から読み込み、終了時（SIGTERM / SIGINT / SIGHUP）に書き出す。
操作のたびには書き出さない。

- 異常終了（SIGKILL、クラッシュ、電源断）では、起動してからの変更がすべて失われる。
  その間に消した卓も戻る。
- 卓は `DELETE /games/:gid` で消すまで残る。
- `games.json` には入場券と伏せた札の中身が入るので、所有者だけが読める権限（0600）で書き出す。
- 読めない `games.json` があると起動しない。空で起動すると、次の終了で上書きして消してしまうため。
  中身を直すか、別の場所へ退避してから起動する。
- 再起動の前に配ったトークンを使い続けるには、JWT の secret を固定する（`--secret` か環境変数 `SECRET`）。
  固定しないと起動のたびに変わり、参加者は卓の URL を開き直して席を選び直すことになる。
  固定していないときは、起動時にログへ警告を出す。
- Docker では `data/` をボリュームにしないと、コンテナを作り直したときに消える。

      docker run -v decks-data:/usr/src/app/data -e SECRET=... <image>


## バージョン

### バージョン取得

GET /version

response: { version: "1.6.0" }


## 入場

### 卓を開く

ticket がどの卓のものかを返す。席の一覧と卓の種類（mode）も一緒に返るので、
参加者はこれ 1 回で席を選べ、画面も卓の種類に合わせられる。

GET /join

header: Authorization: Ticket <ticket>

response: {
  gid: "1",
  players: [ "マスター", "pc1", "pc2", "pc3" ],
  mode: "tarot"
}

### トークン取得

どの卓かは ticket が決めるので、gid は送らない。

POST /token

header: Authorization: Ticket <ticket>

request: { pid: "0" }

response: { token: "..." }


## ゲーム

### 新規ゲーム作成

ticket を含むので、前段で保護すること。

POST /games

request: {
  players: [ "pc1", "pc2", "pc3" ],
  mode: "tarot",
  tarots: [ "4", "18", "7" ]
}

mode は卓の脇に置く札の種類で、必須（省略すると 400）。既定値は無い。

| mode | 置く札 | 必須 |
|---|---|---|
| tarot | タロット山札と、席ごとの切り札 | tarots |
| epitaph | マスターが選んだエピタフ（すべて裏） | epitaphs |
| none | 何も置かない | なし |

- タロットの卓でなければ、タロット山札・捨て札・切り札を空で作る。
- tarots と epitaphs は、その mode のときだけ見る。ほかの mode では省略してよく、送られても使わない。
- epitaphs は 1〜31 の番号（文字列）。0 枚でもよい。知らない番号と重複は 400。
  並びはエピタフの番号順で、シャッフルしない。

request: {
  players: [ "pc1", "pc2", "pc3" ],
  mode: "epitaph",
  epitaphs: [ "1", "12", "24" ]
}

`GET /games/:gid` と同じ形を返す。epitaphs はタロットの卓でもあり、空の配列になる。

response: {
  gid: "1",
  players: [ "マスター", "pc1", "pc2", "pc3" ],
  mode: "epitaph",
  epitaphs: [ "1", "12", "24" ],
  ticket: "kJ3nQ8vZ2pL7mR4tX1aB9c"
}

参加者にはこの ticket を付けた URL を配る。

  https://example.com/decks/play.html?ticket=kJ3nQ8vZ2pL7mR4tX1aB9c

### ゲーム一覧

gid だけを返す。卓の中身を載せないので、応答は卓の数にしか比例しない。
席と ticket は「ゲーム取得」で 1 卓ずつ引く。

GET /games

response: { games: [ { gid: "1" }, { gid: "2" } ] }

### ゲーム取得

1 卓ぶんの席と ticket。一覧は gid だけなので、卓の中身はここで引く。

ticket と、裏のものも含めたエピタフの番号を含むので、前段で保護すること。

GET /games/:gid

response: {
  gid: "1",
  players: [ "マスター", "pc1", "pc2", "pc3" ],
  mode: "epitaph",
  epitaphs: [ "1", "12", "24" ],
  ticket: "kJ3nQ8vZ2pL7mR4tX1aB9c"
}

### ゲーム終了

DELETE /games/:gid

response: { gid: "1" }


## 卓

### 卓

全席の公開状態を1回で取得する。伏せられている札は枚数だけを返し、中身は返さない。
自分の手札は「手札一覧」で取る。タロットの卓でなければ、タロットの枚数はすべて 0。
エピタフは裏の札の番号を返さない（エピタフの卓でなければ空の配列）。

GET /games/:gid/table

response: {
  gid: "1",
  mode: "tarot",
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
  },
  epitaphs: [
    { open: false },
    { open: true, rank: "12" }
  ]
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


## エピタフ

eid は並びの位置（0 から）。

### エピタフ一覧

マスター（pid 0）のトークンなら、裏の札も番号つきで返す。
ほかの席のトークンなら「卓」の epitaphs と同じものを返す。

GET /games/:gid/epitaphs

response: {
  gid: "1",
  epitaphs: [
    { open: false, rank: "1" },
    { open: true, rank: "12" }
  ]
}

### 表にする

マスターだけが呼べる。ほかの席のトークンなら 403。表の札をもう一度表にしても変わらない。
応答は「エピタフ一覧」をマスターが引いたときと同じ形。

席同士は保護しないので、入場券があればマスターの席にもなれる。403 は誤操作よけ。

PUT /games/:gid/epitaphs/:eid/open

response: {
  gid: "1",
  epitaphs: [
    { open: false, rank: "1" },
    { open: true, rank: "12" }
  ]
}

### 裏にする

「表にする」の逆。配信する action には rank を載せない。

PUT /games/:gid/epitaphs/:eid/close

response: {
  gid: "1",
  epitaphs: [
    { open: false, rank: "1" },
    { open: false, rank: "12" }
  ]
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
| epitaph-open | エピタフを表にする | { eid, open: true, rank } |
| epitaph-close | エピタフを裏にする | { eid, open: false }（rank は載せない） |

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
- 401 ticket または token が無い、または検証できない
- 403 トークンの gid / pid がパスと一致しない
- 404 gid / pid / cid に対応するものが無い

卓の中のエンドポイントは、トークンが無ければ席やカードの存在を確かめる前に
401 を返す。存在しない pid でも 404 ではなく 401 になる（席の数や手札の枚数を
401 と 404 の差で測れないようにするため）。
