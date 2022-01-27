'use strict';

const suits = [
	'C', 'D', 'H', 'S'
];
const suitStrings = [
	'クラブ', 'ダイヤ', 'ハート', 'スペード'
];
const ranks = [
	'A', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'J', 'Q', 'K'
];
const rankStrings = [
	'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'
];
const jockerRank = 'X';
const jockerRankString = 'ジョーカー';

function suitToString(suit) {
	if (suits.includes(suit)) {
		return suitStrings[ suits.indexOf(suit) ];
	} else {
		return `[${suit}]`;
	}
}

function rankToString(rank) {
	if (ranks.includes(rank)) {
		return rankStrings[ ranks.indexOf(rank) ];
	} else {
		return jockerRankString;
	}
}


class Card {
	constructor(suit, rank, deck) {
		this.suit = suit;
		this.rank = rank;
		this.deck = deck;
	}

	getSymbols() {
		return {
			suit: this.suit,
			rank: this.rank,
			deck: this.deck
		};
	}

	getName() {
		return `${suitToString(this.suit)} ${rankToString(this.rank)} (${this.deck})`;
	}
}


class Cards {
	constructor(cards) {
		this.cards = [];
		if (cards instanceof Cards) {
			this.cards = cards.from();
		}
	}

	every(cb) {
		this.cards.forEach(card => {
			cb(card);
		});
	}

	from() {
		return this.cards;
	}

	count() {
		return this.cards.length;
	}

	shift() {
		return this.cards.shift();
	}

	unshift(card) {
		return this.cards.unshift(card);
	}

	pop() {
		return this.cards.pop();
	}

	push(card) {
		return this.cards.push(card);
	}

	splice(index) {
		return this.cards.splice(index, 1)[0];
	}

	at(index) {
		return this.cards[index];
	}

	shuffle(n) {
		n = n ?? 10;
		for (let x = 0; x < n; x++) {
			for (let i = this.cards.length - 1; i >= 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[ this.cards[i], this.cards[j] ] = [ this.cards[j], this.cards[i] ];
			}
		}
	}

	getStatus() {
		return {
			length: this.count(),
			cards: this.cards.map(card => card.getName())
		};
	}
}


function newDrawDeck(deck, jocker, shuffle) {
	deck = deck ?? 1;
	jocker = jocker ?? 2;
	shuffle = shuffle ?? 10;
	const cards = new Cards();
	for (let i = 0; i < deck; i++) {
		suits.forEach(suit => {
			ranks.forEach(rank => {
				cards.push(new Card(suit, rank, i));
			});
		});
		for (let j = 0; j < jocker; j++) {
			cards.push(new Card(j, jockerRank, i));
		}
	}
	cards.shuffle(shuffle);
	return cards;
}

function newDiscardPile() {
	return new Cards();
}

function newHand(deck, draw) {
	const cards = new Cards();
	if (deck) {
		for (let i = 0; i < draw; i++) {
			cards.push(deck.shift());
		}
	}
	return cards;
}


module.exports = { newDrawDeck, newDiscardPile, newHand };
