/**
Copyright (c) 2022-2024 Hidenori ISHIKAWA. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import { ajax, getToken, updateStatus, appendOption, removeOption, parseDataValue, parseDataValuesEach, qs, qsa, el, fromHtml, delegate } from './common.js';
import { tarotRanks } from './TNM_tarot.js';

let token;

for (const [rank, name] of tarotRanks.entries()) {
	appendOption('select[name^=tarots]', rank, name);
}

// 新しい行を足す先。#players は 1 行目の .input-group なので、その親。
const playersBox = qs('#players').parentElement;

// common
async function appendGame(gid) {
	try {
		const data = await ajax('./games/' + gid, { method: 'GET' });
		updateStatus(JSON.stringify(data, null, 2));
		qs('#game').append(
			el('div', { class: 'col-3', 'data-gid': data.gid },
				el('a', {
					href: './play.html',
					target: '_blank',
					rel: 'noopener noreferrer',
				}, data.gid)
			),
			el('div', { class: 'col-9', 'data-gid': data.gid }, String(data.players))
		);
		appendOption('#deleteGameSelect', data.gid, data.gid);
	} catch (error) {
		updateStatus(`${error.name}: ${error.message}`);
	}
}

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
		await appendGame(data.gid);
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
		token = await getToken(params.gid, 0);
		const data = await ajax('./games/' + params.gid, {
			method: 'DELETE',
			headers: { 'Authorization': `Bearer ${token}` },
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
	for (const {gid} of data.games) {
		await appendGame(gid);
	}
} catch (error) {
	updateStatus(`${error.name}: ${error.message}`);
}
