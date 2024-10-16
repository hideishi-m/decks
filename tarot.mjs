/**
Copyright (c) 2022 Hidenori ISHIKAWA. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import { readFile } from 'node:fs/promises';

import { Cards } from './card.mjs';

const tarotJson = './public/js/TNM_tarot.json';
const tarotPositions = [
	'U', 'R'
];
const tarotPositionStrings = [
	'正位置', '逆位置'
]
const tarotCards = JSON.parse(await readFile(new URL(tarotJson, import.meta.url)));
const tarotRanks = Object.keys(tarotCards);
const tarotRankStrings = Object.values(tarotCards);

function tarotPositionToString(position) {
	if (tarotPositions.includes(position)) {
		return tarotPositionStrings[ tarotPositions.indexOf(position) ];
	} else {
		return `[${position}]`;
	}
}

function tarotRankToString(rank) {
	if (tarotRanks.includes(rank)) {
		return tarotRankStrings[ tarotRanks.indexOf(rank) ];
	} else {
		return `[${rank}]`;
	}
}


class TarotCard {
	constructor(rank, position) {
		this.rank = rank;
		this.position = position;
	}

	getName() {
		return `${tarotRankToString(this.rank)} ${tarotPositionToString(this.position)}`;
	}

	flip() {
		this.position = 'U' === this.position ? 'R' : 'U';
	}
}


class TarotCards extends Cards {
	shuffle(n) {
		n = n ?? 10;
		for (let x = 0; x < n; x++) {
			for (let i = this.cards.length - 1; i >= 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[ this.cards[i], this.cards[j] ] = [ this.cards[j], this.cards[i] ];
				if (0.5 > Math.random()) {
					this.cards[i].flip();
				}
				if (0.5 > Math.random()) {
					this.cards[j].flip();
				}
			}
		}
	}
}


export function newTarotCard(rank, position) {
	rank = tarotRanks.includes(rank) ? rank : '00';
	position = tarotPositions.includes(position) ? position : 'U';
	return new TarotCard(rank, position);
}


export function newTarotDeck(shuffle, trumps) {
	shuffle = shuffle ?? 10;
	trumps = trumps ?? [];
	const cards = new TarotCards();
	tarotRanks.forEach(rank => {
		if (false === trumps.includes(rank)) {
			cards.push(new TarotCard(rank, 'U'));  // default 'U'
		}
	});
	cards.shuffle(shuffle);
	return cards;
}
