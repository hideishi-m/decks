# トランプデッキAPI

## ゲーム

### 新規ゲーム作成

POST /games

request: { players: [ "pc1", "pc2", "pc3" ] }

response: { id : "1" }

### ゲーム一覧

GET /games

response: { games: [ { game: "1" }, { game: "2" } ] }

### ゲーム取得

GET /games/:id

response: {
  id: "1",
  players: [ "pc1", "pc2", "pc3" ]
}

### ゲーム終了

DELETE /games/:id

response: { id: "1" }


## 山札

### 山札

GET /games/:id/deck

response: {
  id: "1",
  deck: { length: 108 }
}

### 山札をめくる

PUT /games/:id/deck/discard

response: {
  id: "1",
  deck: { length: 107 }
}

### 捨て札を山札に戻す

PUT /games/:id/deck/recycle

response: {
  id: "1",
  deck: { length: 108 }
}


## 捨て札

### 捨て札

GET /games/:id/pile

response: {
  id: "1",
  pile: {
    length: 1,
    card: card
  }
}

### 捨て札を全て山札に戻す

PUT /games/:id/pile/shuffle

response: {
  id: "1",
  pile: { length: 0 }
}


## 手札

### 手札一覧

GET /games/:id/players/:pid

response: {
  id: "1",
  pid: "1",
  player: "pc1",
  hand: { cards: [ array of card ] }
}

### 山札から引く

PUT /games/:id/players/:pid/draw

response: {
  id: "1",
  pid: "1",
  player: "pc1",
  hand: { cards: [ array of card ] }
}

### 捨て札から戻す

PUT /games/:id/players/:pid/recycle

response: {
  id: "1",
  pid: "1",
  player: "pc1",
  hand: { cards: [ array of card ] }
}

### 手札取得

GET /games/:id/players/:pid/cards/:cid

response: {
  id: "1",
  pid: "1",
  player: "pc1",
  cid: "1",
  card: card
}

### 捨て札にする

PUT /games/:id/players/:pid/cards/:cid/discard

response: {
  id: "1",
  pid: "1",
  player: "pc1",
  hand: { cards: [ array of card ] }
}

### 手札を別のプレーヤーに渡す

PUT /games/:id/players/:pid/cards/:cid/pass/:tid

response: {
  id: "1",
  pid: "1",
  player: "pc1",
  hand: { cards: [ array of card ] }
}

### 別のプレーヤーから手札を引く

PUT /games/:id/players/:pid/pick/:tid

response: {
  id: "1",
  pid: "1",
  player: "pc1",
  hand: { cards: [ array of card ] }
}


## タロット山札

### タロット山札

GET /games/:id/tarot/deck

response: {
  id: "1",
  deck: { length: 1 }
}

### タロットをめくる

PUT /games/:id/tarot/deck/discard

response: {
  id: "1",
  deck: { length: 1 }
}


## タロット捨て札

### タロット捨て札

GET /games/:id/tarot/pile

response: {
  id: "1",
  pile: {
    length: 1,
    card: card
  }
}


## タロット切り札

### 切り札

GET /games/:id/tarot/players/:pid

response: {
  id: "1",
  pid: "1",
  player: "pc1",
  hand: { card: card }
}

### 捨て札にする

PUT /games/:id/tarot/players/:pid/discard

response: {
  id: "1",
  pid: "1",
  player: "pc1",
  hand: { card: card }
}
