/**
Copyright (c) 2022-2024 Hidenori ISHIKAWA. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import { ping, timeout, retryWait, ajax, getToken, updateStatus, appendLog, appendOption, updateOptions, removeOption, parseDataValue, qs, el, fromHtml, delegate, createDialog } from './common.js';
import { cardSuits, cardRanks, cardPositions } from './attr.js';
import { tarotRanks } from './TNM_tarot.js';

let gid, pid, socket, token;

const gameModal = createDialog('gameModal', { persistent: true });
const playerModal = createDialog('playerModal', { persistent: true });
const handModal = createDialog('handModal');
const deckModal = createDialog('deckModal');
const pileModal = createDialog('pileModal');
const tarotHandModal = createDialog('tarotHandModal');
const tarotPileModal = createDialog('tarotPileModal');

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
		const cardId = cardSuits.get(card.suit, 1) + (cardSuits.has(card.suit) ? '_' : '') + cardRanks.get(card.rank, 1);
		use = `<use href="./images/svg-cards.svg#${cardId}" x="0" y="0" />`;
	} else {
		use = '<use href="./images/svg-cards.svg#back" x="0" y="0" fill="red" />';
	}
	return fromHtml(`<svg viewBox="0 0 169 245" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" >${use}</svg>`);
}

function createTarotCardImg(card) {
	if (card) {
		const style = cardPositions.get(card.position, 1)
		const img = tarotRanks.get(card.rank, 1);
		const title = tarotRanks.get(card.rank) + (tarotRanks.has(card.rank) ? ' ' : '') + cardPositions.get(card.position);
		return fromHtml(`<img style="max-width: 100%; height: auto; ${style}" src="./images/TNM_tarot/${img}.webp" title="${title}">`);
	} else {
		return fromHtml('<img style="max-width: 100%; height: auto;" src="./images/TNM_tarot/99.webp">');
	}
}

// #gameModal
delegate(gameModal.node, 'button', 'click', toggleGameModal);
function toggleGameModal() {
	gameModal.toggle();
}

// #selectGame
qs('#selectGame').addEventListener('click', selectGame);
async function selectGame() {
	try {
		const params = parseDataValue({
			gid: '#selectGameSelect',
		});
		const data = await ajax('./games/' + params.gid, { method: 'GET' });
		updateStatus(JSON.stringify(data, null, 2));
		gid = data.gid;
		qs('#gameLabel').textContent = data.gid;
		updateOptions('#selectPlayerSelect', data.players);
		updateOptions('#passHandSelect', data.players);
		updateOptions('#pickSelect', data.players);
		togglePlayerModal();
	} catch (error) {
		updateStatus(`${error.name}: ${error.message}`);
	}
}

// #playerModal
delegate(playerModal.node, 'button', 'click', togglePlayerModal);
function togglePlayerModal() {
	playerModal.toggle();
}

// #selectPlayer
qs('#selectPlayer').addEventListener('click', selectPlayer);
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
		qs('#playerLabel').textContent = data.player;
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
delegate(handModal.node, 'button', 'click', toggleHandModal);
function toggleHandModal() {
	handModal.toggle();
}

// #hand
delegate(qs('#hand'), 'svg', 'click', function () {
	qs('#handModalCard').replaceChildren(this.cloneNode(true));
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
		const node = qs('#hand');
		node.replaceChildren();
		for (let i = 0; i < hand.length; i++) {
			const card = createCardSvg(hand.cards[i]);
			card.setAttribute('data-cid', i);
			node.append(el('div', { class: 'col-3' }, card));
		}
	} catch (error) {
		updateStatus(`${error.name}: ${error.message}`);
	}
}
qs('#discardHand').addEventListener('click', discardHand);
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
qs('#passHand').addEventListener('click', passHand);
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
delegate(deckModal.node, 'button', 'click', toggleDeckModal);
function toggleDeckModal() {
	deckModal.toggle();
}

// #deck
delegate(qs('#deck'), 'svg', 'click', function () {
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
		qs('#deckLabel').textContent = deck.length;
		qs('#deck').replaceChildren(
			createCardSvg()
		);
	} catch (error) {
		updateStatus(`${error.name}: ${error.message}`);
	}
}
qs('#drawDeck').addEventListener('click', drawDeck);
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
qs('#discardDeck').addEventListener('click', discardDeck);
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
delegate(pileModal.node, 'button', 'click', togglePileModal);
function togglePileModal() {
	pileModal.toggle();
}

// #pile
delegate(qs('#pile'), 'svg', 'click', function () {
	qs('#pileModalCard').replaceChildren(this.cloneNode(true));
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
		qs('#pileLabel').textContent = pile.length;
		qs('#pile').replaceChildren(
			createCardSvg(pile.card)
		);
	} catch (error) {
		updateStatus(`${error.name}: ${error.message}`);
	}
}
qs('#recycleHand').addEventListener('click', recycleHand);
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
qs('#recycleDeck').addEventListener('click', recycleDeck);
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
qs('#shufflePile').addEventListener('click', shufflePile);
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
qs('#pick').addEventListener('click', pickHand);
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
delegate(tarotHandModal.node, 'button', 'click', toggleTarotHandModal);
function toggleTarotHandModal() {
	tarotHandModal.toggle();
}

// #tarotHand
delegate(qs('#tarotHand'), 'img', 'click', function () {
	qs('#tarotHandModalCard').replaceChildren(this.cloneNode(true));
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
			qs('#tarotHandLabel').textContent = hand.length;
			qs('#tarotHand').replaceChildren(
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
			qs('#tarotHandLabel').textContent = hand.length;
			qs('#tarotHand').replaceChildren(
				createTarotCardImg(hand.card)
			);
		}
	} catch (error) {
		updateStatus(`${error.name}: ${error.message}`);
	}
}
qs('#discardTarotHand').addEventListener('click', discardTarotHand);
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
delegate(tarotPileModal.node, 'button', 'click', toggleTarotPileModal);
function toggleTarotPileModal() {
	tarotPileModal.toggle();
}

// #tarotPile
delegate(qs('#tarotPile'), 'img', 'click', function () {
	qs('#tarotPileModalCard').replaceChildren(this.cloneNode(true));
	toggleTarotPileModal();
});
qs('#flipTarotPile').addEventListener('click', flipTarotPile);
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
		qs('#tarotPileLabel').textContent = pile.length;
		qs('#tarotPile').replaceChildren(
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
	qs('#selectGameSelect').replaceChildren();
	for (const {gid} of data.games) {
		appendOption('#selectGameSelect', gid, gid);
	}
	toggleGameModal();
} catch (error) {
	updateStatus(`${error.name}: ${error.message}`);
}
