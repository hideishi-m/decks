/**
Copyright (c) 2022-2026 Hidenori ISHIKAWA. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import { Attributes } from './attr.js';

const epitaphs = {
	'1':   ['ルシファー',   'LR_01LUCIFER'],
	'2':   ['ファフナー',   'LR_02Fafner'],
	'3':   ['パンドラ',     'LR_03Pandora'],
	'4':   ['モノケロス',   'LR_04Mnoceros'],
	'5':   ['ナイトメア',   'LR_05Nightmare'],
	'6':   ['ベルセルク',   'LR_06Berserk'],
	'7':   ['オルフェウス', 'LR_07Orpeus'],
	'8':   ['アームズ',     'LR_08Arms'],
	'9':   ['イージス',     'LR_09Aegis'],
	'10':  ['イノセンス',   'LR_10inocences'],
	'11':  ['グリモア',     'LR_11Grimor'],
	'12':  ['トリガー',     'LR_12Trogger'],
	'13':  ['メディック',   'LR_13Medic'],
	'14':  ['モニター',     'LR_14Moniter'],
	'15':  ['操り人形',     'LR_15Brainwash'],
	'16':  ['解放',         'LR_16Release'],
	'17':  ['極めし力',     'LR_17Ultimat'],
	'18':  ['空間歪曲',     'LR_18Teleport'],
	'19':  ['殺戮',         'LR_19Slauter'],
	'20':  ['証拠隠滅',     'LR_20Cverup'],
	'21':  ['絶対防御',     'LR_21Protection'],
	'22':  ['大量虐殺',     'LR_22Carnage'],
	'23':  ['連続行動',     'LR_23DabbleAccel'],
	'24':  ['ホムラ',       'LRA_01homura'],
	'25':  ['フブキ',       'LRA_02hubuki'],
	'26':  ['神隠し',       'LRA_03abduction'],
	'27':  ['奇策',         'LRA_04notoover'],
	'28':  ['情報操作',     'LRA_05delude'],
	'29':  ['不滅',         'LRA_06immortal'],
	'30':  ['腹心',         'LRA_07confidant'],
	'31':  ['変装',         'LRA_08disguize'],
};
export const epitaphRanks = new Attributes(Object.entries(epitaphs), ['', 'LR_URA 1']);
