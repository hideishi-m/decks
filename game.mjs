/**
Copyright (c) 2022-2024 Hidenori ISHIKAWA. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import { createDrawDeck, createDiscardPile, createHand, createTarotDeck, createTarotHand } from './card.mjs';

class Game {
	constructor(players, tarots, deck, joker, shuffle, draw) {
		players = [ 'マスター', ...players ];
		this.deck = createDrawDeck(deck, joker, shuffle);
		this.pile = createDiscardPile();
		this.tarotDeck = createTarotDeck(shuffle, tarots);
		this.tarotPile = createDiscardPile();
		this.players = [];
		this.hands = [];
		this.tarotHands = [];
		players.forEach((player, index) => {
			this.players.push(player);
			this.hands.push(createHand(this.deck, draw));
			if (0 === index) {
				this.tarotHands.push(createTarotHand());
			} else {
				this.tarotHands.push(createTarotHand([tarots[index - 1]]));
			}
		});
	}

	shuffle(shuffle) {
		let card;
		while ((card = this.pile.pop()) !== undefined) {
			this.deck.push(card);
		}
		this.deck.shuffle(shuffle);
	}

	getStatus() {
		return {
			deck: { length: this.deck.count() },
			pile: { length: this.pile.count() },
			players: this.players.map((player, index) => {
				return {
					player: player,
					hand: this.hands[index].names(),
					tarotHand: this.tarotHands[index].names()
				}
			}),
			tarotDeck: { length: this.tarotDeck.count() },
			tarotPile: { length: this.tarotPile.count() }
		}
	}

	getPlayers() {
		return this.players;
	}

	getHandOf(player) {
		return new Hand(this, player);
	}

	getDeck() {
		return new Deck(this);
	}

	getPile() {
		return new Pile(this);
	}

	getTarotDeck() {
		return new TarotDeck(this);
	}

	getTarotPile() {
		return new TarotPile(this);
	}

	getTarotHandOf(player) {
		return new TarotHand(this, player);
	}
}


class Deck {
	constructor(game) {
		this.deck = game.deck;
		this.pile = game.pile;
	}

	count() {
		return this.deck.length;
	}

	discard(index) {
		const card = this.deck.splice(index);
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
}


class Pile {
	constructor(game) {
		this.pile = game.pile;
	}

	count() {
		return this.pile.length;
	}

	face() {
		return (this.pile.count() ? this.pile.at(0) : undefined);
	}
}


class Hand {
	constructor(game, player) {
		this.player = player;
		this.hand = game.hands[player];
		this.deck = game.deck;
		this.pile = game.pile;
		this.hands = game.hands;
	}

	at(index) {
		return this.hand.at(index);
	}

	cards() {
		return this.hand;
	}

	draw() {
		const card = this.deck.shift();
		if (undefined !== card) {
			this.hand.push(card);
		}
	}

	discard(index) {
		const card = this.hand.splice(index);
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
		const card = this.hand.splice(index);
		if (undefined !== card) {
			this.hands[player].push(card);
		}
	}

	pickFrom(player) {
		const cards = this.hands[player];
		const index = Math.floor(Math.random() * cards.count());
		const card = cards.splice(index);
		if (undefined !== card) {
			this.hand.push(card);
		}
	}
}


class TarotDeck extends Deck {
	constructor(game) {
		super(game);
		this.deck = game.tarotDeck;
		this.pile = game.tarotPile;
	}
}


class TarotPile extends Pile {
	constructor(game) {
		super(game);
		this.pile = game.tarotPile;
	}

	flip() {
		if (this.pile.count()) {
			this.pile.at(0).flip();
		}
	}
}


class TarotHand extends Hand {
	constructor(game, player) {
		super(game, player);
		this.hand = game.tarotHands[player];
		this.deck = game.tarotDeck;
		this.pile = game.tarotPile;
		this.hands = game.tarotHands;
	}

	face() {
		return (this.hand.count() ? this.hand.at(0) : undefined);
	}
}


export function createGame(players, tarots, deck, joker, shuffle, draw) {
	players = players ?? [];
	tarots = tarots ?? [];
	deck = deck ?? 2;
	joker = joker ?? 2;
	shuffle = shuffle ?? 10;
	draw = draw ?? 4;
	const game = new Game(players, tarots, deck, joker, shuffle, draw);
	return game;
}
