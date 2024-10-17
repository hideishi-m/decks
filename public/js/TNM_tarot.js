/**
Copyright (c) 2024 Hidenori ISHIKAWA. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

const tarots = {
	'0':   ['カブキ',       '00'],
	'1':   ['バサラ',       '01'],
	'2':   ['タタラ',       '02'],
	'3':   ['ミストレス',   '03'],
	'4':   ['カブト',       '04'],
	'5':   ['カリスマ',     '05'],
	'6':   ['マネキン',     '06'],
	'7':   ['カゼ',         '07'],
	'8':   ['フェイト',     '08'],
	'9':   ['クロマク',     '09'],
	'10':  ['エグゼク',     '10'],
	'11':  ['カタナ',       '11'],
	'12':  ['クグツ',       '12'],
	'13':  ['カゲ',         '13'],
	'14':  ['チャクラ',     '14'],
	'15':  ['レッガー',     '15'],
	'16':  ['カブトワリ',   '16'],
	'17':  ['ハイランダー', '17'],
	'18':  ['マヤカシ',     '18'],
	'19':  ['トーキー',     '19'],
	'20':  ['イヌ',         '20'],
	'21':  ['ニューロ',     '21'],
	'-14': ['ヒルコ',       '22'],
	'-18': ['アヤカシ',     '23'],
	'-2':  ['テツジン',     '24'],
	'-9':  ['ハンドラー',   '25'],
	'-12': ['クロガネ',     '26'],
	'-17': ['エトランゼ',   '27'],
	'99':  ['タロット',     '99']
};
const positions = {
	'U': '正位置',
	'R': '逆位置'
};
const defaultRank = '99';
const defaultPosition = 'U';


export const tarotRanks = {
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
		return tarots[ this.from(rank) ][ image ? 1 : 0 ];
	},
	keys: function () {
		return Object.keys(tarots);
	},
	values: function (image) {
		return Object.values(tarots).map((value) => value[ image ? 1 : 0 ]);
	}
};

export const tarotPositions = {
	get default() {
		return defaultPosition;
	},
	from: function (position) {
		return this.has(position) ? position : this.default;
	},
	has: function (position) {
		return this.keys().includes(position);
	},
	get: function (position) {
		return positions[ this.from(position) ];
	},
	keys: function () {
		return Object.keys(positions);
	},
	values: function () {
		return Object.values(positions);
	},
	flip: function(position) {
		return 'U' === this.from(position) ? 'R' : 'U';
	},
	reversed: function(position) {
		return 'R' === this.from(position);
	}
}