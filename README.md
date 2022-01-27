# トランプデッキAPI

## ゲーム

### 新規ゲーム作成

POST /games

request: { players: [ "pc1", "pc2", "pc3" ] }

response: { id : id }

### ゲーム一覧

GET /games

response: { games: [ "1", "2" ] }

## ゲーム取得

GET /games/:id

response: { players: [ "pc1", "pc2", "pc3" ] }


## 手札

### 手札一覧

GET /games/:id/players/:pid

response: {
  player: "pc1",
  pid: "1",
  cards: [ array of card ]
}

### 山札から引く

PUT /games/:id/players/:pid/draw

response: {
  player: "pc1",
  pid: "1",
  cards: [ array of card ]
}

### 捨て札にする

PUT /games/:id/players/:pid/discard/:cid

response: {
  player: "pc1",
  pid: "1",
  cards: [ array of card ]
}

### 捨て札から戻す

PUT /games/:id/players/:pid/recycle

response: {
  player: "pc1",
  pid: "1",
  cards: [ array of card ]
}

### 手札を別のプレーヤーに渡す

PUT /games/:id/players/:pid/pass/:cid/to/:tid

response: {
  player: "pc1",
  pid: "1",
  cards: [ array of card ]
}

### 別のプレーヤーから手札を引く

PUT /games/:id/players/:pid/pick/:tid

response: {
  player: "pc1",
  pid: "1",
  cards: [ array of card ]
}

