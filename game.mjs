/**
Copyright (c) 2022-2024 Hidenori ISHIKAWA. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import { createDeckCards, createPileCards, createHandCards, createTarotDeckCards, createTarotHandCards, createEpitaphCards } from './card.mjs';


// 卓の脇に置く札の種類を、createGame の 2 番目の引数の形から決める。
//   配列（省略を含む）: tarot   … 配列は席ごとの切り札
//   false:              none    … 何も置かない
//   { epitaphs }:       epitaph … 配列は場に置くエピタフ
function modeOf(side) {
	if (false === side) {
		return 'none';
	}
	if (undefined !== side?.epitaphs) {
		return 'epitaph';
	}
	return 'tarot';
}


class Game {
	constructor(players, side, decks, jokers, shuffles, draws) {
		// タロットの卓でなければ、タロット山札も切り札も空で作る。
		// API を直に叩いても札は 1 枚も出てこない。
		this.mode = modeOf(side);
		const tarots = 'tarot' === this.mode ? side : [];
		this.playerNames = [];
		this.deck = createDeckCards(decks, jokers, shuffles);
		this.pile = createPileCards();
		this.hands = [];
		this.tarotDeck = 'tarot' === this.mode
			? createTarotDeckCards(shuffles, tarots)
			: createTarotHandCards();  // 空の TarotCards
		this.tarotPile = createPileCards();
		this.tarotHands = [];
		this.epitaphs = createEpitaphCards('epitaph' === this.mode ? side.epitaphs : []);
		this.shuffles = shuffles;

		[ 'マスター', ...players ].forEach((player, index) => {
			this.playerNames.push(player);
			this.hands.push(createHandCards(this.deck, draws));
			if (0 === index) {
				this.tarotHands.push(createTarotHandCards());
			} else {
				this.tarotHands.push(createTarotHandCards([tarots[index - 1]]));
			}
		});
	}

	toJson() {
		return {
			mode: this.mode,
			deck: this.deck.names(),
			pile: this.pile.names(),
			players: this.playerNames.map((player, index) => {
				return {
					player: player,
					hand: this.hands[index].names(),
					tarotHand: this.tarotHands[index].names(),
				}
			}),
			tarotDeck: this.tarotDeck.names(),
			tarotPile: this.tarotPile.names(),
			epitaphs: this.epitaphs.names(),
		};
	}

	getMode() {
		return this.mode;
	}

	getAllPlayers() {
		return this.playerNames;
	}

	getPlayer(player) {
		return this.playerNames[player];
	}

	getTable() {
		return new Table(this);
	}

	getDeck() {
		return new Deck({
			deck: this.deck,
			pile: this.pile,
		});
	}

	getPile() {
		return new Pile({
			deck: this.deck,
			pile: this.pile,
			shuffles: this.shuffles,
		});
	}

	getHandOfPlayer(player) {
		return new Hand({
			deck: this.deck,
			pile: this.pile,
			hands: this.hands,
		}, player);
	}

	getTarotDeck() {
		return new Deck({
			deck: this.tarotDeck,
			pile: this.tarotPile,
		});
	}

	getTarotPile() {
		return new TarotPile({
			deck: this.tarotDeck,
			pile: this.tarotPile,
			shuffles: this.shuffles,
		});
	}

	getTarotHandOfPlayer(player) {
		return new TarotHand({
			deck: this.tarotDeck,
			pile: this.tarotPile,
			hands: this.tarotHands,
		}, player);
	}

	getEpitaphs() {
		return new Epitaphs({
			epitaphs: this.epitaphs,
		});
	}
}

// 卓の公開状態。全員が同じものを見る。
// 伏せられている札は length だけを出す。中身をクライアントへ渡さない
// （表示側で隠すだけだと DevTools から読める）。
class Table {
	constructor(game) {
		this.game = game;
	}

	toJson() {
		const game = this.game;
		return {
			mode: game.mode,
			seats: game.playerNames.map((player, index) => {
				return {
					pid: `${index}`,
					player: player,
					hand: { length: game.hands[index].length },
					tarot: { length: game.tarotHands[index].length },
				};
			}),
			deck: { length: game.deck.length },
			pile: {
				length: game.pile.length,
				card: game.pile[0],
			},
			tarotDeck: { length: game.tarotDeck.length },
			tarotPile: {
				length: game.tarotPile.length,
				card: game.tarotPile[0],
			},
			epitaphs: game.getEpitaphs().toJson(false),
		};
	}
}


class Deck {
	constructor(game) {
		this.deck = game.deck;
		this.pile = game.pile;
	}

	discard(index) {
		const card = this.deck.splice(index, 1)[0];
		if (undefined !== card) {
			this.pile.unshift(card);
		}
	}

	recycle() {
		const card = this.pile.shift();
		if (undefined !== card) {
			this.deck.unshift(card);  // 先頭に戻す
		}
	}

	toJson() {
		return { length: this.deck.length };
	}
}


class Pile {
	constructor(game) {
		this.deck = game.deck;
		this.pile = game.pile;
		this.shuffles = game.shuffles;
	}

	shuffle() {
		let card;
		while ((card = this.pile.pop()) !== undefined) {
			this.deck.push(card);
		}
		this.deck.shuffle(this.shuffles);
	}

	toJson() {
		return {
			length: this.pile.length,
			card: this.pile[0],
		};
	}
}


class Hand {
	constructor(game, player) {
		this.deck = game.deck;
		this.pile = game.pile;
		this.hands = game.hands;
		this.player = player;
		this.hand = this.hands[player];
	}

	at(index) {
		return this.hand[index];
	}

	draw() {
		const card = this.deck.shift();
		if (undefined !== card) {
			this.hand.push(card);
		}
	}

	discard(index) {
		const card = this.hand.splice(index, 1)[0];
		if (undefined !== card) {
			this.pile.unshift(card);
		}
	}

	recycle() {
		const card = this.pile.shift();
		if (undefined !== card) {
			this.hand.push(card);
		}
	}

	passTo(index, player) {
		const card = this.hand.splice(index, 1)[0];
		if (undefined !== card) {
			this.hands[player].push(card);
		}
	}

	pickFrom(player) {
		const cards = this.hands[player];
		const index = Math.floor(Math.random() * cards.length);
		const card = cards.splice(index, 1)[0];
		if (undefined !== card) {
			this.hand.push(card);
		}
	}

	toJson() {
		return {
			length: this.hand.length,
			cards: this.hand,
		};
	}
}


class TarotPile extends Pile {
	flip() {
		if (undefined !== this.pile[0]) {
			this.pile[0].flip();
		}
	}
}


class TarotHand extends Hand {
	toJson() {
		return {
			length: this.hand.length,
			card: this.hand[0],
		};
	}
}


// 場のエピタフ。表にする・裏にするのはマスターだけ（ルート側で確かめる）。
class Epitaphs {
	constructor(game) {
		this.epitaphs = game.epitaphs;
	}

	at(index) {
		return this.epitaphs[index];
	}

	open(index) {
		this.epitaphs[index].open = true;
	}

	close(index) {
		this.epitaphs[index].open = false;
	}

	ranks() {
		return [ ...this.epitaphs ].map((card) => card.rank);
	}

	// 裏の札の rank は、見てよい人（マスター）にしか出さない。
	toJson(master) {
		return [ ...this.epitaphs ].map((card) => {
			return card.open || master
				? { open: card.open, rank: card.rank }
				: { open: false };
		});
	}
}


// side の形は modeOf を参照。
export function createGame(players, side, decks, jokers, shuffles, draws) {
	players = players ? [ ...players ] : [];
	// 省略は「タロットを使うが誰にも配らない」。false（使わない）とは別物。
	if ('tarot' === modeOf(side)) {
		side = side ? [ ...side ] : [];
	}
	decks = decks ?? 2;
	jokers = jokers ?? 2;
	shuffles = shuffles ?? 10;
	draws = draws ?? 4;
	return new Game(players, side, decks, jokers, shuffles, draws);
}
