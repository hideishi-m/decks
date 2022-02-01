/**
Copyright (c) 2022 Hidenori ISHIKAWA. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

'use strict';

const { newDrawDeck, newDiscardPile, newHand } = require('./card.cjs');

class Game {
	constructor(players, deck, jocker, shuffle, draw) {
		this.deck = newDrawDeck(deck, jocker, shuffle)
		this.pile = newDiscardPile();
		this.hands = [];
		this.players = [ 'マスター' ];
		for (const player of players) {
			this.players.push(player);
		}
		this.players.forEach(() => {
			this.hands.push(newHand(this.deck, draw));
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
					hand: this.hands[index].getStatus()
				}
			})
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
}


class Deck {
	constructor(game) {
		this.game = game;
		this.cards = this.game.deck;
	}

	discard(index) {
		const card = this.cards.splice(index);
		if (undefined !== card) {
			this.game.pile.unshift(card);
		}
	}

	recycle() {
		const card = this.game.pile.shift();
		if (undefined !== card) {
			this.cards.unshift(card);  // 先頭に戻す
		}
	}

	cards() {
		return this.cards.from();
	}
}


class Pile {
	constructor(game) {
		this.game = game;
		this.cards = this.game.pile;
	}

	face() {
		return (this.cards.count() ? this.cards.at(0) : undefined);
	}

	cards() {
		return this.cards.from();
	}
}


class Hand {
	constructor(game, player) {
		this.game = game;
		this.player = player;
		this.cards = this.game.hands[this.player];
	}

	draw() {
		const card = this.game.deck.shift();
		if (undefined !== card) {
			this.cards.push(card);
		}
	}

	discard(index) {
		const card = this.cards.splice(index);
		if (undefined !== card) {
			this.game.pile.unshift(card);
		}
	}

	recycle() {
		const card = this.game.pile.shift();
		if (undefined !== card) {
			this.cards.push(card);
		}
	}

	passTo(index, player) {
		const card = this.cards.splice(index);
		if (undefined !== card) {
			this.game.hands[player].push(card);
		}
	}

	pickFrom(player) {
		const cards = this.game.hands[player];
		const index = Math.floor(Math.random() * cards.count());
		const card = cards.splice(index);
		if (undefined !== card) {
			this.cards.push(card);
		}
	}

	cards() {
		return this.cards.from();
	}
}


function newGame(players, deck, jocker, shuffle, draw) {
	players = players ?? [];
	deck = deck ?? 2;
	jocker = jocker ?? 1;
	shuffle = shuffle ?? 10;
	draw = draw ?? 4;
	const game = new Game(players, deck, jocker, shuffle, draw);
	return game;
}

module.exports = { newGame };
