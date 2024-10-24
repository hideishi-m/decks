/**
Copyright (c) 2022-2024 Hidenori ISHIKAWA. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import { jokerSuit, jokerRank, cardSuits, cardRanks, defaultPosition, cardPositions } from './public/js/attr.js';
import { tarotRanks } from './public/js/TNM_tarot.js';


class Card {
	constructor(suit, rank, deck) {
		this.suit = suit;
		this.rank = rank;
		this.deck = deck;
	}

	name() {
		return `${cardSuits.get(this.suit)} ${cardRanks.get(this.rank)} (${this.deck})`;
	}
}


class TarotCard {
	constructor(rank, position) {
		this.rank = rank;
		this.position = position ?? defaultPosition;
	}

	name() {
		return `${tarotRanks.get(this.rank)} ${cardPositions.get(this.position)}`;
	}

	flip() {
		this.position = cardPositions.flip(this.position);
	}
}


class Cards extends Array {
	names() {
		return this.map((item) => item.name());
	}

	shuffle(n) {
		for (let x = 0; x < n; x++) {
			for (let i = this.length - 1; i >= 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[ this[i], this[j] ] = [ this[j], this[i] ];
			}
		}
	}
}


class TarotCards extends Cards {
	shuffle(n) {
		for (let x = 0; x < n; x++) {
			for (let i = this.length - 1; i >= 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[ this[i], this[j] ] = [ this[j], this[i] ];
				if (0.5 > Math.random()) {
					this[i].flip();
				}
				if (0.5 > Math.random()) {
					this[j].flip();
				}
			}
		}
	}
}


export function createDeckCards(decks, jokers, shuffles) {
	decks = decks ?? 1;
	jokers = jokers ?? 2;
	shuffles = shuffles ?? 10;
	const cards = new Cards();
	for (let i = 0; i < decks; i++) {
		cardSuits.keys([jokerSuit]).forEach((suit) => {
			cardRanks.keys([jokerRank]).forEach((rank) => {
				cards.push(new Card(suit, rank, i));
			});
		});
	}
	for (let i = 0; i < jokers; i++) {
		cards.push(new Card(jokerSuit, jokerRank, i));
	}
	cards.shuffle(shuffles);
	return cards;
}

export function createPileCards() {
	return new Cards();
}

export function createHandCards(deckCards, draws) {
	draws = draws ?? 0;
	const cards = new Cards();
	if (deckCards) {
		for (let i = 0; i < draws; i++) {
			cards.push(deckCards.shift());
		}
	}
	return cards;
}

export function createTarotDeckCards(shuffles, tarots) {
	shuffles = shuffles ?? 10;
	tarots = tarots ? [ ...tarots ] : [];
	const tarotCards = new TarotCards();
	tarotRanks.keys(tarots).forEach((rank) => {
		tarotCards.push(new TarotCard(rank));
	});
	tarotCards.shuffle(shuffles);
	return tarotCards;
}

export function createTarotHandCards(tarots) {
	tarots = tarots ? [ ...tarots ] : [];
	const tarotCards = new TarotCards();
	tarots.filter((rank) => tarotRanks.has(rank)).forEach((rank) => {
		tarotCards.push(new TarotCard(rank));
	});
	return tarotCards;
}
