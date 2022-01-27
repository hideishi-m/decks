'use strict';

const { newDrawDeck, newDiscardPile, newHand } = require('./cards.cjs');

class Game {
	constructor(players, deck, jocker, shuffle, draw) {
		this.deck = newDrawDeck(deck, jocker, shuffle)
		this.pile = newDiscardPile();
		this.hands = [];
		this.players = [ 'ルーラー' ];
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
}


class Hand {
	constructor(game, player) {
		this.game = game;
		this.player = player;
		this.cards = this.game.hands[this.player];
	}

	draw() {
		const card = this.game.deck.shift();
		this.cards.push(card);
	}

	discard(index) {
		const card = this.cards.splice(index);
		this.game.pile.unshift(card);
	}

	recycle() {
		const card = this.game.pile.shift();
		this.cards.push(card);
	}

	passTo(index, player) {
		const card = this.cards.splice(index);
		this.game.hands[player].push(card);
	}

	pickFrom(player) {
		const cards = this.game.hands[player];
		const index = Math.floor(Math.random() * cards.count());
		const card = cards.splice(index);
		this.cards.push(card);
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
