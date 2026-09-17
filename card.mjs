/**
Copyright (c) 2022-2026 Hidenori ISHIKAWA. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import { jokerSuit, jokerRank, cardSuits, cardRanks, defaultPosition, cardPositions } from './public/js/attr.js';
import { tarotRanks } from './public/js/TNM_tarot.js';
import { epitaphRanks } from './public/js/LRQ_epitaph.js';


class Card {
	constructor(suit, rank, deck) {
		this.suit = suit;
		this.rank = rank;
		this.deck = deck;
	}

	name() {
		return `${cardSuits.get(this.suit)} ${cardRanks.get(this.rank)} (${this.deck})`;
	}

	toState() {
		return { suit: this.suit, rank: this.rank, deck: this.deck };
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

	toState() {
		return { rank: this.rank, position: this.position };
	}
}


// エピタフ。向きは無く、表（open）か裏かだけを持つ。
// 裏の札の rank を誰に見せるかは game.mjs の Epitaphs.toJson が決める。
class EpitaphCard {
	constructor(rank, open) {
		this.rank = rank;
		this.open = open ?? false;
	}

	name() {
		return `${epitaphRanks.get(this.rank)} ${this.open ? '表' : '裏'}`;
	}

	toState() {
		return { rank: this.rank, open: this.open };
	}
}


class Cards extends Array {
	names() {
		return this.map((item) => item.name());
	}

	// 保存用の素の配列。並びはそのまま。
	toStates() {
		return [ ...this ].map((item) => item.toState());
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
			const card = deckCards.shift();
			if (undefined === card) {
				break;  // 山札が尽きたら配れるところまでで止める。
			}
			cards.push(card);
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


// 選ばれたエピタフを表の番号順に、すべて裏で並べる。シャッフルはしない。
export function createEpitaphCards(epitaphs) {
	epitaphs = epitaphs ? [ ...epitaphs ] : [];
	const epitaphCards = new Cards();
	epitaphRanks.keys().filter((rank) => epitaphs.includes(rank)).forEach((rank) => {
		epitaphCards.push(new EpitaphCard(rank));
	});
	return epitaphCards;
}


// toStates の値から札を作り直す。入れ物のクラスも作ったときと揃える
// （TarotCards の shuffle は向きも変える）。自分が書かない値が混じっていたら投げる。
function restoreCards(cards, items, valid, create) {
	if (false === Array.isArray(items)) {
		throw new TypeError(`cards must be an array: ${JSON.stringify(items)}`);
	}
	items.forEach((item) => {
		if (false === valid(item ?? {})) {
			throw new TypeError(`invalid card: ${JSON.stringify(item)}`);
		}
		cards.push(create(item));
	});
	return cards;
}

// 山札・捨て札・手札。
export function restoreDeckCards(items) {
	return restoreCards(new Cards(), items,
		(item) => cardSuits.has(item.suit) && cardRanks.has(item.rank) && Number.isInteger(item.deck),
		(item) => new Card(item.suit, item.rank, item.deck));
}

function validTarot(item) {
	return tarotRanks.has(item.rank) && cardPositions.has(item.position);
}

function createTarot(item) {
	return new TarotCard(item.rank, item.position);
}

// タロット山札と切り札。
export function restoreTarotCards(items) {
	return restoreCards(new TarotCards(), items, validTarot, createTarot);
}

// タロット捨て札。createPileCards と同じく Cards に入れる。
export function restoreTarotPileCards(items) {
	return restoreCards(new Cards(), items, validTarot, createTarot);
}

export function restoreEpitaphCards(items) {
	return restoreCards(new Cards(), items,
		(item) => epitaphRanks.has(item.rank) && 'boolean' === typeof item.open,
		(item) => new EpitaphCard(item.rank, item.open));
}
