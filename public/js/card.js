/**
Copyright (c) 2024 Hidenori ISHIKAWA. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

const suits = {
	'C': ['クラブ',   'club'],
	'D': ['ダイヤ',   'diamond'],
	'H': ['ハート',   'heart'],
	'S': ['スペード', 'spade'],
	'Z': ['',         '']
};
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
	'X': ['ジョーカー', 'jocker_black'],
	'Z': ['',           '']
}
const defaultSuit = 'Z';
const defaultRank = 'Z';
export const jokerRank = 'X';

export const cardSuits = {
	get default() {
		return defaultSuit;
	},
	from: function (suit) {
		return this.has(suit) ? suit : this.default;
	},
	has: function (suit) {
		return this.keys().includes(suit);
	},
	get: function (suit, image) {
		return suits[ this.from(suit) ][ image ? 1 : 0 ];
	},
	keys: function () {
		return Object.keys(suits);
	},
	values: function (image) {
		return Object.values(suits).map((value) => value[ image ? 1 : 0 ]);
	}
};

export const cardRanks = {
	get default() {
		return defaultRank;
	},
	from: function (rank) {
		return this.has(rank) ? rank : this.default;
	},
	has: function (rank) {
		return this.keys().includes(rank);
	},
	get: function (rank, image) {
		return ranks[ this.from(rank) ][ image ? 1 : 0 ];
	},
	keys: function () {
		return Object.keys(ranks);
	},
	values: function (image) {
		return Object.values(ranks).map((value) => value[ image ? 1 : 0 ]);
	}
};

export function getCardSvgId(suit, rank) {
	suit = cardSuits.get(suit, 'image');
	rank = cardRanks.get(rank, 'image');
	return (suit ? `${suit}_` : '' ) + (rank ? `${rank}` : 'back');
}
