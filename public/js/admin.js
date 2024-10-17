/**
Copyright (c) 2022 Hidenori ISHIKAWA. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import { ajax, updateStatus, appendOption, removeOption, parseDataValue, parseDataValuesEach } from './common.js';
import { tarotRanks } from './TNM_tarot.js';

$(document).ready(async function () {

	for (const [rank, name] of tarotRanks.entries()) {
		appendOption('select[name^=trumps]', rank, name);
	}

	// common
	async function appendGame(id, token) {
		try {
			token = token ?? '';
			const data = await ajax('./games/' + id, {
				method: 'GET',
				headers: { "Authorization": `Bearer ${token}` }
			});
			updateStatus(JSON.stringify(data, null, 2));
			$('#game').append($('<div />', {
				class: 'col-3',
				['data-id']: data.id
			}).append($('<a />', {
				href: `./play.html?token=${token}`,
				target: '_blank',
				rel: 'noopener noreferrer'
			}).text(data.id)));
			$('#game').append($('<div />', {
				class: 'col-9',
				['data-id']: data.id
			}).text(data.players));
			appendOption('#deleteGameSelect', data.id, data.id);
		} catch (error) {
			updateStatus(`${error.name}: ${error.message}`);
		}
	}

	// #newGame
    $('#newGame').click(newGame);
    async function newGame() {
		try {
			const params = parseDataValuesEach({
				players: 'input[name^=players]',
				trumps: 'select[name^=trumps]',
			});
			for (const [i, value] of params.trumps.entries()) {
				params.trumps[i] = tarotRanks.has(value) ? value : null;
			}
			const data = await ajax('./games', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				cache: 'no-cache',
				body: JSON.stringify({
					players: params.players,
					trumps: params.trumps
				})
			});
			updateStatus(JSON.stringify(data, null, 2));
			await appendGame(data.id, data.token);
		} catch (error) {
			updateStatus(`${error.name}: ${error.message}`);
		}
    }

	// #players
	$('.add').click(function () {
		const html = $('.copy').html();
		$('#players').parent().append(html);
	});
	$('#players').parent().on('click', '.remove', function () {
		$(this).parents('.input-group').remove();
	});

	// #deleteGame
    $('#deleteGame').click(deleteGame);
    async function deleteGame() {
		try {
			const params = parseDataValue({
				id: '#deleteGameSelect'
			});
			const data = await ajax('./games/' + params.id, { method: 'DELETE' } );
			updateStatus(JSON.stringify(data, null, 2));
			$(`#game div[data-id='${data.id}']`).each(function () {
				$(this).remove();
			});
			removeOption('#deleteGameSelect', data.id);
		} catch (error) {
			updateStatus(`${error.name}: ${error.message}`);
		}
    }

	// ready
	try {
		const data = await ajax('./games', { method: 'GET' });
		updateStatus(JSON.stringify(data, null, 2));
		for (const id of data.games) {
			await appendGame(id);
		}
	} catch (error) {
		updateStatus(`${error.name}: ${error.message}`);
	}
});
