/**
Copyright (c) 2022-2024 Hidenori ISHIKAWA. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import { ajax, updateStatus, appendOption, removeOption, parseDataValue, parseDataValuesEach, qs, qsa, el, fromHtml, delegate } from './common.js';
import { tarotRanks } from './TNM_tarot.js';

for (const [rank, name] of tarotRanks.entries()) {
	appendOption('select[name^=tarots]', rank, name);
}

// 新しい行を足す先。#players は 1 行目の .input-group なので、その親。
const playersBox = qs('#players').parentElement;

// 参加者へ配る URL。ticket だけで卓が決まる。
function playUrl(ticket) {
	return new URL(`./play.html?ticket=${ticket}`, document.location.href).href;
}

// common
// 一覧の 1 件をそのまま受け取る。POST /games も同じ形を返す。
function appendGame(game) {
	const url = playUrl(game.ticket);
	const link = el('a', {
		href: url,
		target: '_blank',
		rel: 'noopener noreferrer',
		class: 'invite',
	}, url);
	const copy = el('button', {
		type: 'button',
		class: 'btn btn-secondary copy-invite',
		'data-url': url,
	}, 'コピー');
	qs('#game').append(
		el('div', { class: 'col-1', 'data-gid': game.gid }, game.gid),
		el('div', { class: 'col-3', 'data-gid': game.gid }, String(game.players)),
		el('div', { class: 'col-8 invite-cell', 'data-gid': game.gid }, link, copy)
	);
	appendOption('#deleteGameSelect', game.gid, game.gid);
}

// クリップボードに入れる。失敗したら選択しておいて手で写せるようにする。
delegate(qs('#game'), '.copy-invite', 'click', function () {
	const button = this;
	navigator.clipboard.writeText(button.dataset.url).then(() => {
		button.textContent = 'コピーした';
		setTimeout(() => { button.textContent = 'コピー'; }, 1500);
	}).catch(() => {
		const range = document.createRange();
		range.selectNodeContents(button.closest('.invite-cell').querySelector('.invite'));
		const selection = window.getSelection();
		selection.removeAllRanges();
		selection.addRange(range);
	});
});

// #newGame
qs('#newGame').addEventListener('click', newGame);
async function newGame() {
	try {
		const params = parseDataValuesEach({
			players: 'input[name^=players]',
			tarots: 'select[name^=tarots]',
		});
		for (const [i, value] of params.tarots.entries()) {
			params.tarots[i] = tarotRanks.has(value) ? value : null;
		}
		const data = await ajax('./games', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			cache: 'no-cache',
			body: JSON.stringify({
				players: params.players,
				tarots: params.tarots,
			}),
		});
		updateStatus(JSON.stringify(data, null, 2));
		appendGame(data);
	} catch (error) {
		updateStatus(`${error.name}: ${error.message}`);
	}
}

// #players
qs('.add').addEventListener('click', function () {
	// .copy は d-none の雛型。tarots の option は起動時に一緒に埋まっている。
	playersBox.append(fromHtml(qs('.copy').innerHTML));
});
delegate(playersBox, '.remove', 'click', function () {
	this.closest('.input-group').remove();
});

// #deleteGame
qs('#deleteGame').addEventListener('click', deleteGame);
async function deleteGame() {
	try {
		const params = parseDataValue({
			gid: '#deleteGameSelect',
		});
		const data = await ajax('./games/' + params.gid, {
			method: 'DELETE',
		} );
		updateStatus(JSON.stringify(data, null, 2));
		for (const node of qsa(`#game div[data-gid='${data.gid}']`)) {
			node.remove();
		}
		removeOption('#deleteGameSelect', data.gid);
	} catch (error) {
		updateStatus(`${error.name}: ${error.message}`);
	}
}

// ready
try {
	const data = await ajax('./games', { method: 'GET' });
	updateStatus(JSON.stringify(data, null, 2));
	for (const game of data.games) {
		appendGame(game);
	}
} catch (error) {
	updateStatus(`${error.name}: ${error.message}`);
}
