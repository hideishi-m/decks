/**
Copyright (c) 2022-2024 Hidenori ISHIKAWA. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import { jokerSuit, jokerRank, cardSuits, cardRanks } from './public/js/attr.js';


class Card {
	constructor(suit, rank, deck) {
		this.suit = suit;
		this.rank = rank;
		this.deck = deck;
	}

	getName() {
		return `${cardSuits.get(this.suit)} ${cardRanks.get(this.rank)} (${this.deck})`;
	}
}


export class Cards {  // exported for tarot.mjs
	constructor(cards) {
		this.cards = [];
		if (cards instanceof Cards) {
			this.cards = cards.from();
		}
	}

	every(cb) {
		this.cards.forEach((card) => {
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
			cards: this.cards.map((card) => card.getName())
		};
	}
}


export function createDrawDeck(deck, joker, shuffle) {
	deck = deck ?? 1;
	joker = joker ?? 2;
	shuffle = shuffle ?? 10;
	const cards = new Cards();
	for (let i = 0; i < deck; i++) {
		cardSuits.keys([jokerSuit]).forEach((suit) => {
			cardRanks.keys([jokerRank]).forEach((rank) => {
				cards.push(new Card(suit, rank, i));
			});
		});
	}
	for (let i = 0; i < joker; i++) {
		cards.push(new Card(jokerSuit, jokerRank, i));
	}
	cards.shuffle(shuffle);
	return cards;
}

export function createDiscardPile() {
	return new Cards();
}

export function createHand(deck, draw) {
	const cards = new Cards();
	if (deck) {
		for (let i = 0; i < draw; i++) {
			cards.push(deck.shift());
		}
	}
	return cards;
}
