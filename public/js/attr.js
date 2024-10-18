/**
Copyright (c) 2022-2024 Hidenori ISHIKAWA. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

export class Attributes extends Map {
	constructor(iterable, defaults) {
		super(iterable);
		this.defaults = defaults ?? super.values().next().value.map(() => '');
	}

	get(key, index) {
		index = index ?? 0;
		return this.has(key) ? super.get(key)[index] : this.defaults[index];
	}

	keys(excludes) {
		excludes = excludes ? [ ...excludes ] : [];
		return [ ...super.keys() ].filter((key) => false === excludes.includes(key));
	}

	values(index) {
		index = index ?? 0;
		return [ ...super.values() ].map((value) => value[index]);
	}

	entries(index) {
		index = index ?? 0;
		return [ ...super.entries() ].map(([key, value]) => [key, value[index]]);
	}
}


class PositionAttributes extends Attributes {
	reversed(key) {
		return 'R' === key;
	}

	flip(key) {
		return this.reversed(key) ? 'U' : 'R';
	}
}


const suits = {
	'C': ['クラブ',     'club'],
	'D': ['ダイヤ',     'diamond'],
	'H': ['ハート',     'heart'],
	'S': ['スペード',   'spade'],
	'X': ['ジョーカー', 'joker']
};
export const jokerSuit = 'X';
export const cardSuits = new Attributes(Object.entries(suits));
export const jokerRank = 'X';
const ranks = {
	'A': ['エース',     '1'],
	'2': ['2',          '2'],
	'3': ['3',          '3'],
	'4': ['4',          '4'],
	'5': ['5',          '5'],
	'6': ['6',          '6'],
	'7': ['7',          '7'],
	'8': ['8',          '8'],
	'9': ['9',          '9'],
	'0': ['10',         '10'],
	'J': ['ジャック',   'jack'],
	'Q': ['クイーン',   'queen'],
	'K': ['キング',     'king'],
	'X': ['ジョーカー', 'black']
};
export const cardRanks = new Attributes(Object.entries(ranks), ['', 'back']);
export const defaultPosition = 'U';
const positions = {
	'U': ['正位置', ''],
	'R': ['逆位置', 'transform: rotate(180deg);']
};
export const cardPositions = new PositionAttributes(Object.entries(positions));
