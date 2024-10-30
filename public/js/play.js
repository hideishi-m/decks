/**
Copyright (c) 2022-2024 Hidenori ISHIKAWA. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import { ping, timeout, retryWait, ajax, getToken, updateStatus, appendLog, appendOption, updateOptions, removeOption, parseDataValue } from './common.js';
import { cardSuits, cardRanks, cardPositions } from './attr.js';
import { tarotRanks } from './TNM_tarot.js';

$(document).ready(async function () {
	let gid, pid, socket, token;

	const gameModal = new bootstrap.Modal(document.getElementById('gameModal'), {
		backdrop: 'static',
		keyboard: false,
	});
	const playerModal = new bootstrap.Modal(document.getElementById('playerModal'), {
		backdrop: 'static',
		keyboard: false,
	});
	const handModal = new bootstrap.Modal(document.getElementById('handModal'));
	const deckModal = new bootstrap.Modal(document.getElementById('deckModal'));
	const pileModal = new bootstrap.Modal(document.getElementById('pileModal'));
	const tarotHandModal = new bootstrap.Modal(document.getElementById('tarotHandModal'));
	const tarotPileModal = new bootstrap.Modal(document.getElementById('tarotPileModal'));

	function createSocket() {
		const socket = new WebSocket(`${document.location.protocol.replace('http', 'ws')}//${document.location.host}${document.location.pathname.replace(/\/[^/]+$/, '')}`);
		socket.addEventListener('message', onMessage);
		socket.addEventListener('open', onOpen);
		socket.addEventListener('close', onClose);
		return socket;
	}

	function keepAlive() {
		if (socket.readyState === socket.OPEN) {
			socket.send(ping);
		}
		setTimeout(keepAlive, timeout);
	}

	function onOpen(event) {
		socket.send(JSON.stringify({
			gid: gid,
			pid: pid,
			token: token,
		}));
	}

	function onClose(event) {
		socket.removeEventListener('message', onMessage);
		socket.removeEventListener('open', onOpen);
		socket.removeEventListener('close', onClose);
		setTimeout(() => {
			socket = createSocket();
		}, retryWait);
	}

	async function onMessage(event) {
		try {
			if (ping === event.data) {
				return;
			}
			console.log(event.data);
			const data = JSON.parse(event.data) ?? {};
			// hand: gid,pid,player,tid
			if (data.hand) {
				if (data.hand.player && data.hand.playerTo) {
					appendLog(`${data.hand.player} passed a card to ${data.hand.playerTo}`);
				} else if (data.hand.player && data.hand.playerFrom) {
					appendLog(`${data.hand.player} picked a card from ${data.hand.playerFrom}`);
				} else {
					appendLog('hand was updated');
				}
				if (pid === data.hand.tid) {
					await updateHand();
				}
			}
			// deck: gid,pid,player
			// deck: gid
			else if (data.deck) {
				if (data.deck.player) {
					appendLog(`${data.deck.player} drew a card`);
				} else {
					appendLog('deck was updated');
				}
				if (pid !== data.deck.pid) {
					await updateDeck();
				}
			}
			// pile: gid,pid,player
			// pile: gid
			else if (data.pile) {
				if (data.pile.player) {
					appendLog(`${data.pile.player} discarded a card`);
				} else {
					appendLog('pile was updated');
				}
				if (pid !== data.pile.pid) {
					await updatePile();
				}
			}
			// tarot: gid,pid,player
			// tarot: gid
			else if (data.tarot) {
				if (data.tarot.player) {
					appendLog(`${data.tarot.player} discarded a tarot card`);
				} else {
					appendLog('tarot pile was updated');
				}
				if (pid !== data.tarot.pid) {
					await updateTarotPile();
				}
			}
		} catch (error) {
			updateStatus(`${error.name}: ${error.message}`);
		}
	}

	function createCardSvg(card) {
		let use;
		if (card) {
			const gid = cardSuits.get(card.suit, 1) + (cardSuits.has(card.suit) ? '_' : '') + cardRanks.get(card.rank, 1);
			use = `<use href="./images/svg-cards.svg#${gid}" x="0" y="0" />`;
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
			return $(`<img style="max-width: 100%; height: auto; ${style}" src="./images/TNM_tarot/${img}.webp" title="${title}">`);
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
				gid: '#selectGameSelect',
			});
			const data = await ajax('./games/' + params.gid, { method: 'GET' });
			updateStatus(JSON.stringify(data, null, 2));
			gid = data.gid;
			$('#gameLabel').text(data.gid);
			updateOptions('#selectPlayerSelect', data.players);
			updateOptions('#passHandSelect', data.players);
			updateOptions('#pickSelect', data.players);
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
				pid: '#selectPlayerSelect',
			});
			token = await getToken(gid, params.pid);
			const data = await ajax('./games/' + gid + '/players/' + params.pid, {
				method: 'GET',
				headers: { 'Authorization': `Bearer ${token}` }
			});
			updateStatus(JSON.stringify(data, null, 2));
			removeOption('#passHandSelect', data.pid);
			removeOption('#pickSelect', data.pid);
			pid = data.pid;
			$('#playerLabel').text(data.player);
			await updateDeck();
			await updatePile();
			await updateHand(data.hand);
			await updateTarotPile();
			await updateTarotHand();

			socket = createSocket();
			keepAlive();
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
				const data = await ajax('./games/' + gid + '/players/' + pid, {
					method: 'GET',
					headers: { 'Authorization': `Bearer ${token}` }
				});
				updateStatus(JSON.stringify(data, null, 2));
				hand = data.hand;
			}
			$('#hand').empty();
			for (let i = 0; i < hand.length; i++) {
				$('#hand').append(
					$('<div />', { class: 'col-3' }).append(
						createCardSvg(hand.cards[i]).attr('data-cid', i)
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
				cid: '#handModalCard svg',
			});
			const data = await ajax('./games/' + gid + '/players/' + pid + '/cards/' + params.cid + '/discard', {
				method: 'PUT',
				headers: { 'Authorization': `Bearer ${token}` }
			});
			updateStatus(JSON.stringify(data, null, 2));
			await updateHand(data.hand);
			await updatePile(data.pile);
		} catch (error) {
			updateStatus(`${error.name}: ${error.message}`);
		}
	}
	$('#passHand').click(passHand);
	async function passHand() {
		try {
			const params = parseDataValue({
				cid: '#handModalCard svg',
				tid: '#passHandSelect',
			});
			const data = await ajax('./games/' + gid + '/players/' + pid + '/cards/' + params.cid + '/pass/' + params.tid, {
				method: 'PUT',
				headers: { 'Authorization': `Bearer ${token}` }
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
	async function updateDeck(deck) {
		try {
			if (undefined === deck) {
				const data = await ajax('./games/' + gid + '/deck', {
					method: 'GET',
					headers: { 'Authorization': `Bearer ${token}` }
				});
				updateStatus(JSON.stringify(data, null, 2));
				deck = data.deck;
			}
			$('#deckLabel').text(deck.length);
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
			const data = await ajax('./games/' + gid + '/players/' + pid + '/draw', {
				method: 'PUT',
				headers: { 'Authorization': `Bearer ${token}` }
			});
			updateStatus(JSON.stringify(data, null, 2));
			await updateHand(data.hand);
			await updateDeck(data.deck);
		} catch (error) {
			updateStatus(`${error.name}: ${error.message}`);
		}
	}
	$('#discardDeck').click(discardDeck);
	async function discardDeck() {
		try {
			const data = await ajax('./games/' + gid + '/deck/discard', {
				method: 'PUT',
				headers: { 'Authorization': `Bearer ${token}` }
			});
			updateStatus(JSON.stringify(data, null, 2));
			await updateDeck(data.deck);
			await updatePile(data.pile);
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
	async function updatePile(pile) {
		try {
			if (undefined === pile) {
				const data = await ajax('./games/' + gid + '/pile', {
					method: 'GET',
					headers: { 'Authorization': `Bearer ${token}` }
				});
				updateStatus(JSON.stringify(data, null, 2));
				pile = data.pile;
			}
			$('#pileLabel').text(pile.length);
			$('#pile').empty().append(
				createCardSvg(pile.card)
			);
		} catch (error) {
			updateStatus(`${error.name}: ${error.message}`);
		}
	}
	$('#recycleHand').click(recycleHand);
	async function recycleHand() {
		try {
			const data = await ajax('./games/' + gid + '/players/' + pid + '/recycle', {
				method: 'PUT',
				headers: { 'Authorization': `Bearer ${token}` }
			});
			updateStatus(JSON.stringify(data, null, 2));
			await updateHand(data.hand);
			await updatePile(data.pile);
		} catch (error) {
			updateStatus(`${error.name}: ${error.message}`);
		}
	}
	$('#recycleDeck').click(recycleDeck);
	async function recycleDeck() {
		try {
			const data = await ajax('./games/' + gid + '/deck/recycle', {
				method: 'PUT',
				headers: { 'Authorization': `Bearer ${token}` }
			});
			updateStatus(JSON.stringify(data, null, 2));
			await updateDeck(data.deck);
			await updatePile(data.pile);
		} catch (error) {
			updateStatus(`${error.name}: ${error.message}`);
		}
	}
	$('#shufflePile').click(shufflePile);
	async function shufflePile() {
		try {
			const data = await ajax('./games/' + gid + '/pile/shuffle', {
				method: 'PUT',
				headers: { 'Authorization': `Bearer ${token}` }
			});
			updateStatus(JSON.stringify(data, null, 2));
			await updateDeck(data.deck);
			await updatePile(data.pile);
		} catch (error) {
			updateStatus(`${error.name}: ${error.message}`);
		}
	}

	// #pick
	$('#pick').click(pickHand);
	async function pickHand() {
		try {
			const params = parseDataValue({
				tid: '#pickSelect',
			});
			const data = await ajax('./games/' + gid + '/players/' + pid + '/pick/' + params.tid, {
				method: 'PUT',
				headers: { 'Authorization': `Bearer ${token}` },
			});
			updateStatus(JSON.stringify(data, null, 2));
			await updateHand(data.hand);
		} catch (error) {
			updateStatus(`${error.name}: ${error.message}`);
		}
	}

	// #tarotHandModal
	$('#tarotHandModal').on('click', 'button', toggleTarotHandModal);
	function toggleTarotHandModal() {
		tarotHandModal.toggle();
	}

	// #tarotHand
	$('#tarotHand').on('click', 'img', function () {
		$('#tarotHandModalCard').empty().append($(this).clone());
		toggleTarotHandModal();
	});
	async function updateTarotHand(hand) {
		try {
			if ('0' === pid) {
				if (undefined === hand) {
					const data = await ajax('./games/' + gid + '/tarot/deck', {
						method: 'GET',
						headers: { 'Authorization': `Bearer ${token}` },
					});
					updateStatus(JSON.stringify(data, null, 2));
					hand = data.deck;
				}
				$('#tarotHandLabel').text(hand.length);
				$('#tarotHand').empty().append(
					createTarotCardImg()
				);
			} else {
				if (undefined === hand) {
					const data = await ajax('./games/' + gid + '/tarot/players/' + pid, {
						method: 'GET',
						headers: { 'Authorization': `Bearer ${token}` },
					});
					updateStatus(JSON.stringify(data, null, 2));
					hand = data.hand;
				}
				$('#tarotHandLabel').text(hand.length);
				$('#tarotHand').empty().append(
					createTarotCardImg(hand.card)
				);
			}
		} catch (error) {
			updateStatus(`${error.name}: ${error.message}`);
		}
	}
	$('#discardTarotHand').click(discardTarotHand);
	async function discardTarotHand() {
		try {
			if ('0' === pid) {
				const data = await ajax('./games/' + gid + '/tarot/deck/discard', {
					method: 'PUT',
					headers: { 'Authorization': `Bearer ${token}` },
				});
				updateStatus(JSON.stringify(data, null, 2));
				await updateTarotHand(data.deck);
				await updateTarotPile(data.pile);
			} else {
				const data = await ajax('./games/' + gid + '/tarot/players/' + pid + '/discard', {
					method: 'PUT',
					headers: { 'Authorization': `Bearer ${token}` },
				});
				updateStatus(JSON.stringify(data, null, 2));
				await updateTarotHand(data.hand);
				await updateTarotPile(data.pile);
			}
		} catch (error) {
			updateStatus(`${error.name}: ${error.message}`);
		}
	}

	// #tarotPileModal
	$('#tarotPileModal').on('click', 'button', toggleTarotPileModal);
	function toggleTarotPileModal() {
		tarotPileModal.toggle();
	}

	// #tarotPile
	$('#tarotPile').on('click', 'img', function () {
		$('#tarotPileModalCard').empty().append($(this).clone());
		toggleTarotPileModal();
	});
	$('#flipTarotPile').click(flipTarotPile);
	async function flipTarotPile() {
		try {
			const data = await ajax('./games/' + gid + '/tarot/pile/flip', {
				method: 'PUT',
				headers: { 'Authorization': `Bearer ${token}` },
			});
			updateStatus(JSON.stringify(data, null, 2));
			await updateTarotPile(data.pile);
		} catch (error) {
			updateStatus(`${error.name}: ${error.message}`);
		}
	}
	async function updateTarotPile(pile) {
		try {
			if (undefined === pile) {
				const data = await ajax('./games/' + gid + '/tarot/pile', {
					method: 'GET',
					headers: { 'Authorization': `Bearer ${token}` },
				});
				updateStatus(JSON.stringify(data, null, 2));
				pile = data.pile;
			}
			$('#tarotPileLabel').text(pile.length);
			$('#tarotPile').empty().append(
				createTarotCardImg(pile.card)
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
		for (const {gid} of data.games) {
			appendOption('#selectGameSelect', gid, gid);
		}
		toggleGameModal();
	} catch (error) {
		updateStatus(`${error.name}: ${error.message}`);
	}
});
