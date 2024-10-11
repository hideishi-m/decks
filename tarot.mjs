/**
Copyright (c) 2022 Hidenori ISHIKAWA. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import { readFile } from 'fs/promises';

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
	constructor(position, rank) {
		this.position = position;
		this.rank = rank;
	}

	getSymbols() {
		return {
			position: this.position,
			rank: this.rank
		};
	}

	getName() {
		return `${tarotPositionToString(this.position)} ${tarotRankToString(this.rank)}`;
	}

	flip() {
		this.position = 'U' === this.position ? 'R' : 'U';
	}
}


export function newTarotDeck(shuffle) {
	shuffle = shuffle ?? 10;
	const cards = new Cards();
	tarotPositions.forEach(position => {
		tarotRanks.forEach(rank => {
			cards.push(new TarotCard(position, rank));
		});
	});
	cards.shuffle(shuffle);
	const tarotSet = new Set();
	for (let i = 0; i < cards.count(); i++) {
		const rank = cards.at(i).rank;
		if (tarotSet.has(rank)) {
			cards.splice(i);
			i--;
		} else {
			tarotSet.add(rank);
		}
	}
	return cards;
}