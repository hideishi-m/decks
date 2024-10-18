/**
Copyright (c) 2022-2024 Hidenori ISHIKAWA. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import { ping, timeout, ajax, updateStatus, appendLog, appendOption, updateOptions, removeOption, parseDataValue } from './common.js';
import { cardSuits, cardRanks, cardPositions } from './attr.js';
import { tarotRanks } from './TNM_tarot.js';

$(document).ready(async function () {
	let id, pid, socket;

	const token = (new URLSearchParams(document.location.search))?.get('token');

	const gameModal = new bootstrap.Modal(document.getElementById('gameModal'), {
		backdrop: 'static',
		keyboard: false
	});
	const playerModal = new bootstrap.Modal(document.getElementById('playerModal'), {
		backdrop: 'static',
		keyboard: false
	});
	const handModal = new bootstrap.Modal(document.getElementById('handModal'));
	const deckModal = new bootstrap.Modal(document.getElementById('deckModal'));
	const pileModal = new bootstrap.Modal(document.getElementById('pileModal'));
	const trumpModal = new bootstrap.Modal(document.getElementById('trumpModal'));
	const tarotModal = new bootstrap.Modal(document.getElementById('tarotModal'));

	function createSocket() {
		const socket = new WebSocket(`${document.location.protocol.replace('http', 'ws')}//${document.location.host}${document.location.pathname.replace(/\/[^/]+$/, '')}`);
		socket.addEventListener('message', onMessage);
		socket.addEventListener('close', onClose);
		return socket;
	}

	function keepAlive() {
		if (socket.readyState === socket.OPEN) {
			socket.send(ping);
		}
		setTimeout(keepAlive, timeout);
	}

	async function onClose(event) {
		socket.removeEventListener('message', onMessage);
		socket.removeEventListener('close', onClose);
		socket = createSocket();
	}

	async function onMessage(event) {
		try {
			if (ping === event.data) {
				return;
			}
			const data = JSON.parse(event.data) ?? {};
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
					if (pid !== data.deck.pid) {
						await updateDeck();
					}
				} else {
					appendLog('deck was updated');
					await updateDeck();
				}
			}
			// pile: id,pid,player,pile
			// pile: id,pile
			else if (data.pile) {
				if (data.pile.player) {
					appendLog(`${data.pile.player} discarded a card`);
					if (pid !== data.pile.pid) {
						await updatePile();
					}
				} else {
					appendLog('pile was updated');
					await updatePile();
				}
			}
			// tarot: id,pid,player,trump
			// tarot: id,tarot
			else if (data.tarot) {
				if (data.tarot.player) {
					appendLog(`${data.tarot.player} discarded a trump`);
					if (pid !== data.tarot.pid) {
						await updateTarot();
					}
				} else {
					appendLog('tarot was updated');
					await updateTarot();
				}
			}
		} catch (error) {
			updateStatus(`${error.name}: ${error.message}`);
		}
	}

	socket = createSocket();
	keepAlive();

	function createCardSvg(card) {
		let use;
		if (card) {
			const id = cardSuits.get(card.suit, 1) + (cardSuits.has(card.suit) ? '_' : '') + cardRanks.get(card.rank, 1);
			use = `<use href="./images/svg-cards.svg#${id}" x="0" y="0" />`;
		} else {
			use = '<use href="./images/svg-cards.svg#back" x="0" y="0" fill="red" />';
		}
		return $(`<svg viewBox="0 0 169 245" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" >${use}</svg>`);
	}

	function createTarotCardImg(card) {
		if (card) {
			const style = cardPositions.get(card.position, 1)
			const img = tarotRanks.get(card.rank, 1);
			const title = tarotRanks.get(card.rank) + (tarotRanks.has(card.rank) ? ' ' : '') + cardPositions.get(card.position);
			return $(`<img style="max-width: 100%; height: auto; ${style}" src="./images/TNM_tarot/${img}.webp"> title="${title}"`);
		} else {
			return $('<img style="max-width: 100%; height: auto;" src="./images/TNM_tarot/99.webp">');
		}
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
			const data = await ajax('./games/' + params.id, { method: 'GET' });
			updateStatus(JSON.stringify(data, null, 2));
			id = data.id;
			$('#gameLabel').text(data.id);
			updateOptions('#selectPlayerSelect', data.players);
			updateOptions('#passHandSelect', data.players);
			updateOptions('#pickSelect', data.players);
			await updateDeck();
			await updatePile();
			await updateTarot();
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
			const data = await ajax('./games/' + id + '/players/' + params.pid, {
				method: 'GET',
				headers: { "Authorization": `Bearer ${token}` }
			});
			updateStatus(JSON.stringify(data, null, 2));
			removeOption('#passHandSelect', data.pid);
			removeOption('#pickSelect', data.pid);
			pid = data.pid;
			$('#playerLabel').text(data.player);
			await updateHand(data.hand);
			await updateTrump();

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
				const data = await ajax('./games/' + id + '/players/' + pid, {
					method: 'GET',
					headers: { "Authorization": `Bearer ${token}` }
				});
				updateStatus(JSON.stringify(data, null, 2));
				hand = data.hand;
			}
			$('#hand').empty();
			for (let i = 0; i < hand.length; i++) {
				$('#hand').append(
					$('<div />', { class: 'col-3' }).append(
						createCardSvg(hand[i]).attr('data-cid', i)
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
			const data = await ajax('./games/' + id + '/players/' + pid + '/cards/' + params.cid + '/discard', {
				method: 'PUT',
				headers: { "Authorization": `Bearer ${token}` }
			});
			updateStatus(JSON.stringify(data, null, 2));
			await updateHand(data.hand);
			await updatePile();
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
			const data = await ajax('./games/' + id + '/players/' + pid + '/cards/' + params.cid + '/pass/' + params.tid, {
				method: 'PUT',
				headers: { "Authorization": `Bearer ${token}` }
			});
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
	$('#deck').on('click', 'svg', function () {
		toggleDeckModal();
	});
	async function updateDeck() {
		try {
			const data = await ajax('./games/' + id + '/deck', {
				method: 'GET',
				headers: { "Authorization": `Bearer ${token}` }
			});
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
			const data = await ajax('./games/' + id + '/players/' + pid + '/draw', {
				method: 'PUT',
				headers: { "Authorization": `Bearer ${token}` }
			});
			updateStatus(JSON.stringify(data, null, 2));
			await updateHand(data.hand);
			await updateDeck();
		} catch (error) {
			updateStatus(`${error.name}: ${error.message}`);
		}
	}
	$('#discardDeck').click(discardDeck);
	async function discardDeck() {
		try {
			const data = await ajax('./games/' + id + '/deck/discard', {
				method: 'PUT',
				headers: { "Authorization": `Bearer ${token}` }
			});
			updateStatus(JSON.stringify(data, null, 2));
			await updateDeck();
			await updatePile();
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
	async function updatePile() {
		try {
			const data = await ajax('./games/' + id + '/pile', {
				method: 'GET',
				headers: { "Authorization": `Bearer ${token}` }
			});
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
			const data = await ajax('./games/' + id + '/players/' + pid + '/recycle', {
				method: 'PUT',
				headers: { "Authorization": `Bearer ${token}` }
			});
			updateStatus(JSON.stringify(data, null, 2));
			await updateHand(data.hand);
			await updatePile();
		} catch (error) {
			updateStatus(`${error.name}: ${error.message}`);
		}
	}
	$('#recycleDeck').click(recycleDeck);
	async function recycleDeck() {
		try {
			const data = await ajax('./games/' + id + '/deck/recycle', {
				method: 'PUT',
				headers: { "Authorization": `Bearer ${token}` }
			});
			updateStatus(JSON.stringify(data, null, 2));
			await updateDeck();
			await updatePile();
		} catch (error) {
			updateStatus(`${error.name}: ${error.message}`);
		}
	}
	$('#shufflePile').click(shufflePile);
	async function shufflePile() {
		try {
			const data = await ajax('./games/' + id + '/pile/shuffle', {
				method: 'PUT',
				headers: { "Authorization": `Bearer ${token}` }
			});
			updateStatus(JSON.stringify(data, null, 2));
			await updateDeck();
			await updatePile();
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
			const data = await ajax('./games/' + id + '/players/' + pid + '/pick/' + params.tid, {
				method: 'PUT',
				headers: { "Authorization": `Bearer ${token}` }
			});
			updateStatus(JSON.stringify(data, null, 2));
			await updateHand(data.hand);
		} catch (error) {
			updateStatus(`${error.name}: ${error.message}`);
		}
	}

	// #trumpModal
	$('#trumpModal').on('click', 'button', toggleTrumpModal);
	function toggleTrumpModal() {
		trumpModal.toggle();
	}

	// #trump
	$('#trump').on('click', 'img', function () {
		$('#trumpModalCard').empty().append($(this).clone());
		toggleTrumpModal();
	});
	async function updateTrump() {
		try {
			const data = await ajax('./games/' + id + '/players/' + pid + '/trump', {
				method: 'GET',
				headers: { "Authorization": `Bearer ${token}` }
			});
			updateStatus(JSON.stringify(data, null, 2));
			$('#trump').empty().append(
				createTarotCardImg(data.trump)
			);
		} catch (error) {
			updateStatus(`${error.name}: ${error.message}`);
		}
	}
	$('#discardTrump').click(discardTrump);
	async function discardTrump() {
		try {
			if ('0' === pid) {
				const data = await ajax('./games/' + id + '/tarot/draw', {
					method: 'PUT',
					headers: { "Authorization": `Bearer ${token}` }
				});
				updateStatus(JSON.stringify(data, null, 2));
				await updateTarot();
			} else {
				const data = await ajax('./games/' + id + '/players/' + pid + '/trump/discard', {
					method: 'PUT',
					headers: { "Authorization": `Bearer ${token}` }
				});
				updateStatus(JSON.stringify(data, null, 2));
				await updateTarot();
				await updateTrump();
			}
		} catch (error) {
			updateStatus(`${error.name}: ${error.message}`);
		}
	}

	// #tarotModal
	$('#tarotModal').on('click', 'button', toggleTarotModal);
	function toggleTarotModal() {
		tarotModal.toggle();
	}

	// #tarot
	$('#tarot').on('click', 'img', function () {
		$('#tarotModalCard').empty().append($(this).clone());
		toggleTarotModal();
	});
	$('#flipTarot').click(flipTarot);
	async function flipTarot() {
		try {
			const data = await ajax('./games/' + id + '/tarot/flip', {
				method: 'PUT',
				headers: { "Authorization": `Bearer ${token}` }
			});
			updateStatus(JSON.stringify(data, null, 2));
			await updateTarot();
		} catch (error) {
			updateStatus(`${error.name}: ${error.message}`);
		}
	}
	async function updateTarot() {
		try {
			const data = await ajax('./games/' + id + '/tarot', {
				method: 'GET',
				headers: { "Authorization": `Bearer ${token}` }
			});
			updateStatus(JSON.stringify(data, null, 2));
			$('#tarotLabel').text(data.tarot.length);
			$('#tarot').empty().append(
				createTarotCardImg(data.card)
			);
		} catch (error) {
			updateStatus(`${error.name}: ${error.message}`);
		}
	}

	// ready
	try {
		const data = await ajax('./games', { method: 'GET' });
		updateStatus(JSON.stringify(data, null, 2));
		$('#selectGameSelect').empty();
		for (const game of data.games) {
			appendOption('#selectGameSelect', game, game);
		}
		toggleGameModal();
	} catch (error) {
		updateStatus(`${error.name}: ${error.message}`);
	}
});
