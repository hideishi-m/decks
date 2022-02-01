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
