/**
Copyright (c) 2022 Hidenori ISHIKAWA. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

async function ajax(url, args) {
	const response = await fetch(url, args);
	if (false === response.ok) {
		throw new Error(`${response.status} ${response.statusText}`);
	}
	return await response.json();
}

function updateStatus(text) {
	$('#status').empty().append($('<pre />').text(text));
}

function appendLog(data) {
	const text = $('#log').text();
	$('#log').text(data + '\n' + text);
}

function appendOption(selector, id, text) {
	$(selector).append($('<option />', {
		value: id
	}).text(text));
}

function updateOptions(selector, array) {
	$(selector).empty();
	for (let i = 0; i < array.length; i++) {
		appendOption(selector, i, array[i]);
	}
}

function removeOption(selector, id) {
	$(`${selector} option[value='${id}']`).remove();
}

function parseDataValue(settings) {
	const data = {};
	for (const [key, selector] of Object.entries(settings)) {
		data[key] = undefined !== $(selector).data(key) ? $(selector).data(key) : $(selector).val();
		if (false === /^\d+$/.test(data[key])) {
			throw new Error(key + ' is empty');
		}
	}
	return data;
}

$(document).ready(async function () {
	let id, pid;

	const gameModal = new bootstrap.Modal(document.getElementById("gameModal"), {
		backdrop: 'static',
		keyboard: false
	});
	const playerModal = new bootstrap.Modal(document.getElementById("playerModal"), {
		backdrop: 'static',
		keyboard: false
	});
	const handModal = new bootstrap.Modal(document.getElementById("handModal"));
	const deckModal = new bootstrap.Modal(document.getElementById("deckModal"));
	const pileModal = new bootstrap.Modal(document.getElementById("pileModal"));

	const socket = new WebSocket(`ws://${document.location.host}`);
	socket.addEventListener('message', async function (event) {
		console.log(event.data);
		await parseMessage(event.data);
	});

	async function parseMessage(data) {
		try {
			data = JSON.parse(data) ?? {};
			// hand: id,pid,player,tid
			if (data.hand) {
				appendLog(`${data.hand.player} picked a card from you`);
				await updateHand();
			}
			// deck: id,pid,player
			// deck: id
			else if (data.deck) {
				if (data.deck.player) {
					appendLog(`${data.deck.player} drew a card`);
					await updateDeck(data.deck.id);
				} else {
					appendLog('deck was updated');
					await updateDeck(data.deck.id);
				}
			}
			// pile: id,pid,player,pile
			// pile: id,pile
			else if (data.pile) {
				if (data.pile.player) {
					appendLog(`${data.pile.player} discarded a card`);
					await updatePile(data.pile.id);
				} else {
					appendLog('pile was updated');
					await updatePile(data.pile.id);
				}
			}
		} catch (error) {
			updateStatus(`${error.name}: ${error.message}`);
		}
	}

	function createCardSvg(card) {
		let use;
		if (card) {
			const suits = { C: 'club', D: 'diamond', H: 'heart', S: 'spade' };
			const ranks = { A: '1', 0: '10', J: 'jack', Q: 'queen', K: 'king', X: 'joker_black' };
			const suit = suits[card.suit] ? (suits[card.suit] + '_') : '';
			const rank = ranks[card.rank] ?? card.rank;
			use = `<use href="/images/svg-cards.svg#${suit}${rank}" x="0" y="0" />`;
		} else {
			use = '<use href="/images/svg-cards.svg#back" x="0" y="0" fill="red" />';
		}
		return $(`<svg viewBox="0 0 169 245" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" >${use}</svg>`);
	}

	// #gameModal
	$('#gameModal').on('click', 'button', toggleGameModal);
	function toggleGameModal() {
		gameModal.toggle();
	}

	// #selectGame
	$('#selectGame').click(selectGame);
	async function selectGame() {
		try {
			const params = parseDataValue({
				id: '#selectGameSelect'
			});
			const data = await ajax('/games/' + params.id, { method: 'GET' });
			updateStatus(JSON.stringify(data, null, 2));

			id = data.id;
			$('#gameLabel').text(data.id);
			updateOptions('#selectPlayerSelect', data.players);
			updateOptions('#passHandSelect', data.players);
			updateOptions('#pickSelect', data.players);
			await updateDeck(data.id);
			await updatePile(data.id);
			togglePlayerModal();
		} catch (error) {
			updateStatus(`${error.name}: ${error.message}`);
		}
	}

	// #playerModal
	$('#playerModal').on('click', 'button', togglePlayerModal);
	function togglePlayerModal() {
		playerModal.toggle();
	}

	// #selectPlayer
	$('#selectPlayer').click(selectPlayer);
	async function selectPlayer() {
		try {
			const params = parseDataValue({
				pid: '#selectPlayerSelect'
			});
			const data = await ajax('/games/' + id + '/players/' + params.pid, { method: 'GET' });
			updateStatus(JSON.stringify(data, null, 2));

			removeOption('#passHandSelect', data.pid);
			removeOption('#pickSelect', data.pid);
			pid = data.pid;
			$("#playerLabel").text(data.player);
			await updateHand(data.hand);

			socket.send(JSON.stringify({
				id: id,
				pid: pid
			}));
		} catch (error) {
			updateStatus(`${error.name}: ${error.message}`);
		}
	}

	// #handModal
	$('#handModal').on('click', 'button', toggleHandModal);
	function toggleHandModal() {
		handModal.toggle();
	}

	// #hand
	$('#hand').on('click', 'svg', function () {
		$('#handModalCard').empty().append($(this).clone());
		toggleHandModal();
	});
	async function updateHand(hand) {
		try {
			if (undefined === hand) {
				const data = await ajax('/games/' + id + '/players/' + pid, { method: 'GET' });
				updateStatus(JSON.stringify(data, null, 2));

				hand = data.hand;
			}
			$("#hand").empty();
			for (let i = 0; i < hand.cards.length; i++) {
				$("#hand").append(
					$("<div />", { class: "col" }).append(
						createCardSvg(hand.cards[i]).attr("data-cid", i)
					)
				);
			}
		} catch (error) {
			updateStatus(`${error.name}: ${error.message}`);
		}
	}
	$('#discardHand').click(discardHand);
	async function discardHand() {
		try {
			const params = parseDataValue({
				cid: '#handModalCard svg'
			});
			const data = await ajax('/games/' + id + '/players/' + pid + '/cards/' + params.cid + '/discard', { method: 'PUT' });
			updateStatus(JSON.stringify(data, null, 2));

			await updateHand(data.hand);
			await updatePile(data.id);
		} catch (error) {
			updateStatus(`${error.name}: ${error.message}`);
		}
	}
	$('#passHand').click(passHand);
	async function passHand() {
		try {
			const params = parseDataValue({
				cid: '#handModalCard svg',
				tid: '#passHandSelect'
			});
			const data = await ajax('/games/' + id + '/players/' + pid + '/cards/' + params.cid + '/pass/' + params.tid, { method: 'PUT' });
			updateStatus(JSON.stringify(data, null, 2));

			await updateHand(data.hand);
		} catch (error) {
			updateStatus(`${error.name}: ${error.message}`);
		}
	}

	// #deckModal
	$('#deckModal').on('click', 'button', toggleDeckModal);
	function toggleDeckModal() {
		deckModal.toggle();
	}

	// #deck
	$("#deck").on("click", "svg", function () {
		toggleDeckModal();
	});
	async function updateDeck(id) {
		try {
			const data = await ajax('/games/' + id + '/deck', { method: 'GET' });
			updateStatus(JSON.stringify(data, null, 2));

			$('#deckLabel').text(data.deck.length);
			$('#deck').empty().append(
				createCardSvg()
			);
		} catch (error) {
			updateStatus(`${error.name}: ${error.message}`);
		}
	}
	$('#drawDeck').click(drawDeck);
	async function drawDeck() {
		try {
			const data = await ajax('/games/' + id + '/players/' + pid + '/draw', { method: 'PUT' });
			updateStatus(JSON.stringify(data, null, 2));

			await updateHand(data.hand);
			await updateDeck(data.id);
		} catch (error) {
			updateStatus(`${error.name}: ${error.message}`);
		}
	}
	$('#discardDeck').click(discardDeck);
	async function discardDeck() {
		try {
			const data = await ajax('/games/' + id + '/deck/discard', { method: 'PUT' });
			updateStatus(JSON.stringify(data, null, 2));

			await updateDeck(data.id);
			await updatePile(data.id);
		} catch (error) {
			updateStatus(`${error.name}: ${error.message}`);
		}
	}

	// #pileModal
	$('#pileModal').on('click', 'button', togglePileModal);
	function togglePileModal() {
		pileModal.toggle();
	}

	// #pile
	$('#pile').on('click', 'svg', function () {
		$('#pileModalCard').empty().append($(this).clone());
		togglePileModal();
	});
	async function updatePile(id) {
		try {
			const data = await ajax('/games/' + id + '/pile', { method: 'GET' });
			updateStatus(JSON.stringify(data, null, 2));

			$('#pileLabel').text(data.pile.length);
			$('#pile').empty().append(
				createCardSvg(data.card)
			);
		} catch (error) {
			updateStatus(`${error.name}: ${error.message}`);
		}
	}
	$('#recycleHand').click(recycleHand);
	async function recycleHand() {
		try {
			const data = await ajax('/games/' + id + '/players/' + pid + '/recycle', { method: 'PUT' });
			updateStatus(JSON.stringify(data, null, 2));

			await updateHand(data.hand);
			await updatePile(data.id);
		} catch (error) {
			updateStatus(`${error.name}: ${error.message}`);
		}
	}
	$('#recycleDeck').click(recycleDeck);
	async function recycleDeck() {
		try {
			const data = await ajax('/games/' + id + '/deck/recycle', { method: 'PUT' });
			updateStatus(JSON.stringify(data, null, 2));

			await updateDeck(data.id);
			await updatePile(data.id);
		} catch (error) {
			updateStatus(`${error.name}: ${error.message}`);
		}
	}
	$('#shufflePile').click(shufflePile);
	async function shufflePile() {
		try {
			const data = await ajax('/games/' + id + '/pile/shuffle', { method: 'PUT' });
			updateStatus(JSON.stringify(data, null, 2));

			await updateDeck(data.id);
			await updatePile(data.id);
		} catch (error) {
			updateStatus(`${error.name}: ${error.message}`);
		}
	}

	// #pick
	$('#pick').click(pickHand);
	async function pickHand() {
		try {
			const params = parseDataValue({
				tid: '#pickSelect'
			});
			const data = await ajax('/games/' + id + '/players/' + pid + '/pick/' + params.tid, { method: 'PUT' });
			updateStatus(JSON.stringify(data, null, 2));

			await updateHand(data.hand);
		} catch (error) {
			updateStatus(`${error.name}: ${error.message}`);
		}
	}

	// ready
	try {
		const data = await ajax('/games', { method: 'GET' });
		updateStatus(JSON.stringify(data, null, 2));

		updateOptions('#selectGameSelect', data.games);
		toggleGameModal();
	} catch (error) {
		updateStatus(`${error.name}: ${error.message}`);
	}
});
