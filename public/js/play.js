/**
Copyright (c) 2022-2024 Hidenori ISHIKAWA. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import { ping, timeout, retryWait, ajax, join, getToken, updateStatus, appendLog, updateOptions, removeOption, parseDataValue, qs, el, fromHtml, delegate, createDialog } from './common.js';
import { cardSuits, cardRanks, cardPositions } from './attr.js';
import { tarotRanks } from './TNM_tarot.js';

const MASTER = '0';
// 他席の扇に並べる伏せ札の上限。これを超えたら重ねたままにする。
const FANNED = 5;

let gid, pid, socket, token;
// 卓への入場券。URL から受け取る。これが無ければ何も始まらない。
const ticket = new URLSearchParams(document.location.search).get('ticket');
let table;
// 自分の切り札。面は自分にしか見えないので table からは引けない。
let myTarot;
// 直前に処理した action.seq。飛んでいたら取りこぼしなので卓を取り直す。
let lastSeq;
// 一度切れたか。切れた後に開いたときだけ取り直す（初回は参加時に取得済み）。
let reopened = false;

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const playerModal = createDialog('playerModal', { persistent: true });
const handModal = createDialog('handModal');
const seatModal = createDialog('seatModal');
const deckModal = createDialog('deckModal');
const pileModal = createDialog('pileModal');
const tarotDeckModal = createDialog('tarotDeckModal');
const tarotHandModal = createDialog('tarotHandModal');
const tarotPileModal = createDialog('tarotPileModal');

function isMaster() {
	return MASTER === pid;
}

function seatOf(seatPid) {
	return table?.seats?.find((seat) => seat.pid === seatPid);
}

// ---- WebSocket ----

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
	// 繋ぎ直した間の action は受け取れないので、開き直したら取り直す。
	if (reopened) {
		reopened = false;
		resync();
	}
}

function onClose(event) {
	reopened = true;
	socket.removeEventListener('message', onMessage);
	socket.removeEventListener('open', onOpen);
	socket.removeEventListener('close', onClose);
	setTimeout(() => {
		socket = createSocket();
	}, retryWait);
}

// 場に出た札だけが名前を持つ。伏せたままなら空文字。
function cardName(card) {
	if (undefined === card || null === card) {
		return '';
	}
	if (undefined !== card.suit) {
		return `（${cardSuits.get(card.suit)}の${cardRanks.get(card.rank)}）`;
	}
	return `（${tarotRanks.get(card.rank)} ${cardPositions.get(card.position)}）`;
}

// action は自己記述的なので、1 件から 1 行のログを組み立てられる。
function describeAction(action) {
	const who = action.player;
	const card = cardName(action.card);
	switch (action.type) {
		case 'draw':
			return `${who} が山札から1枚引いた`;
		case 'discard':
			return `${who} が手札を捨て札にした${card}`;
		case 'recycle':
			return `${who} が捨て札を手札に戻した${card}`;
		case 'pass':
			return `${who} が ${action.target} へ1枚渡した`;
		case 'pick':
			return `${who} が ${action.target} から1枚引いた`;
		case 'deck-discard':
			return `${who} が山札をめくった${card}`;
		case 'deck-recycle':
			return `${who} が捨て札を山札に戻した`;
		case 'shuffle':
			return `${who} が捨て札を山札に戻して切った`;
		case 'tarot-deck-discard':
			return `${who} がタロット山札をめくった${card}`;
		case 'tarot-discard':
			return `${who} が切り札を捨て札にした${card}`;
		case 'tarot-flip':
			return `${who} がタロット捨て札を反転させた${card}`;
		default:
			return `${who} が ${action.type} をした`;
	}
}

// 卓も手札も切り札も取り直す。action を取りこぼしたときと、繋ぎ直したとき。
async function resync() {
	try {
		lastSeq = undefined;
		await fetchTable();
		await updateHand();
		await fetchTarotHand();
	} catch (error) {
		updateStatus(`${error.name}: ${error.message}`);
	}
}

async function onMessage(event) {
	try {
		if (ping === event.data) {
			return;
		}
		console.log(event.data);
		const data = JSON.parse(event.data) ?? {};
		const action = data.action;
		if (undefined === action) {
			return;
		}
		appendLog(describeAction(action));

		// 番号が飛んでいたら、間の動きは追えない。卓ごと取り直して追いつく。
		if (undefined !== lastSeq && action.seq !== lastSeq + 1) {
			appendLog(`${action.seq - lastSeq - 1} 件取りこぼしたので取り直す`);
			await resync();
			lastSeq = action.seq;
			return;
		}
		lastSeq = action.seq;

		// 席は描き直しで作り変わるので、動く前の位置を先に押さえておく。
		const [fromNode] = flightOf(action);
		const fromRect = fromNode?.getBoundingClientRect();
		updateTable(action.table);
		const [, toNode] = flightOf(action);
		fly(fromRect, toNode?.getBoundingClientRect(), action.card);
		pulse(action.pid, verbOf(action));
		if (null !== action.tid) {
			pulse(action.tid, 'pick' === action.type ? '抜かれた' : '受け取った');
		}

		// 自分の手札の中身は action に載らないので、動いたときだけ取り直す。
		if (pid === action.pid || pid === action.tid) {
			await updateHand();
		}
	} catch (error) {
		updateStatus(`${error.name}: ${error.message}`);
	}
}

// ---- カード ----

function createCardSvg(card, size) {
	let use;
	if (card) {
		const cardId = cardSuits.get(card.suit, 1) + (cardSuits.has(card.suit) ? '_' : '') + cardRanks.get(card.rank, 1);
		use = `<use href="./images/svg-cards.svg#${cardId}" x="0" y="0" />`;
	} else {
		use = '<use href="./images/svg-cards.svg#back" x="0" y="0" fill="red" />';
	}
	const svg = fromHtml(`<svg class="card${size ? ' ' + size : ''}" viewBox="0 0 169 245" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" >${use}</svg>`);
	if (card) {
		svg.setAttribute('aria-label', cardName(card).slice(3));
	}
	return svg;
}

function createTarotCardImg(card, size) {
	const cls = `card${size ? ' ' + size : ''}`;
	if (card) {
		const style = cardPositions.get(card.position, 1);
		const img = tarotRanks.get(card.rank, 1);
		const title = tarotRanks.get(card.rank) + (tarotRanks.has(card.rank) ? ' ' : '') + cardPositions.get(card.position);
		return fromHtml(`<img class="${cls}" style="${style}" src="./images/TNM_tarot/${img}.webp" title="${title}" alt="${title}">`);
	}
	return fromHtml(`<img class="${cls}" src="./images/TNM_tarot/99.webp" alt="伏せたタロット">`);
}

function createEmptySlot(size) {
	return el('div', { class: `card card-empty${size ? ' ' + size : ''}` });
}

function createCardNode(card, size) {
	// タロットには suit が無い。
	if (card && undefined === card.suit) {
		return createTarotCardImg(card, size);
	}
	return createCardSvg(card, size);
}

// ---- 動きを見せる ----

function seatNode(seatPid) {
	return pid === seatPid
		? qs('#myseat')
		: qs(`#opponents .seat[data-pid="${seatPid}"]`);
}

function fanNode(seatPid) {
	return seatNode(seatPid)?.querySelector('.fan');
}

function tarotNode(seatPid) {
	return pid === seatPid
		? qs('#tarotHand')
		: seatNode(seatPid)?.querySelector('.tarot-slot');
}

// どこからどこへ飛ぶか。載っていない type は飛ばさない。
function flightOf(action) {
	switch (action.type) {
		case 'draw':
			return [ qs('#deck'), fanNode(action.pid) ];
		case 'discard':
			return [ fanNode(action.pid), qs('#pile') ];
		case 'recycle':
			return [ qs('#pile'), fanNode(action.pid) ];
		case 'pass':
			return [ fanNode(action.pid), fanNode(action.tid) ];
		case 'pick':
			return [ fanNode(action.tid), fanNode(action.pid) ];
		case 'deck-discard':
			return [ qs('#deck'), qs('#pile') ];
		case 'deck-recycle':
		case 'shuffle':
			return [ qs('#pile'), qs('#deck') ];
		case 'tarot-deck-discard':
			return [ qs('#tarotDeck'), qs('#tarotPile') ];
		case 'tarot-discard':
			return [ tarotNode(action.pid), qs('#tarotPile') ];
		default:
			return [ null, null ];
	}
}

function verbOf(action) {
	switch (action.type) {
		case 'draw':
		case 'pick':
			return '引いた';
		case 'discard':
			return '捨てた';
		case 'recycle':
			return '拾った';
		case 'pass':
			return '渡した';
		case 'deck-discard':
		case 'tarot-deck-discard':
			return 'めくった';
		case 'deck-recycle':
			return '戻した';
		case 'shuffle':
			return '切った';
		case 'tarot-discard':
			return '切り札を切った';
		case 'tarot-flip':
			return '反転させた';
		default:
			return action.type;
	}
}

function fly(fromRect, toRect, card) {
	if (reduceMotion || undefined === fromRect || undefined === toRect) {
		return;
	}
	const ghost = createCardNode(card);
	ghost.classList.add('ghost');
	ghost.style.width = `${toRect.width}px`;
	ghost.style.height = `${toRect.height}px`;
	const start = `translate(${fromRect.left + (fromRect.width - toRect.width) / 2}px, ${fromRect.top + (fromRect.height - toRect.height) / 2}px)`;
	ghost.style.transform = `${start} scale(0.85)`;
	document.body.append(ghost);
	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			ghost.style.transform = `translate(${toRect.left}px, ${toRect.top}px) scale(1)`;
			ghost.style.opacity = '0.15';
		});
	});
	setTimeout(() => ghost.remove(), 500);
}

function pulse(seatPid, text) {
	const node = seatNode(seatPid);
	if (null === node || undefined === node) {
		return;
	}
	node.classList.add('seat-acting');
	const bubble = el('div', { class: 'bubble' }, text);
	node.append(bubble);
	setTimeout(() => {
		node.classList.remove('seat-acting');
		bubble.remove();
	}, 1600);
}

// ---- 卓 ----

// 他席は弧の上に等間隔で並べる。人数は可変なので座標は計算で出す。
function placeSeat(node, index, total) {
	const t = 1 === total ? 0.5 : (index + 0.5) / total;
	const angle = (170 - t * 160) * Math.PI / 180;
	node.style.setProperty('--x', `${(50 + 33 * Math.cos(angle)).toFixed(2)}%`);
	node.style.setProperty('--y', `${(50 - 16 * Math.sin(angle)).toFixed(2)}%`);
}

function createSeat(seat) {
	const node = el('div', { class: 'seat', 'data-pid': seat.pid });

	const name = el('div', { class: 'seat-name' },
		el('span', null, seat.player));
	if (MASTER === seat.pid) {
		name.append(el('span', { class: 'seat-role' }, 'GM'));
	}
	name.append(el('span', { class: 'seat-count' }, `${seat.hand.length}`));

	const fan = el('div', {
		class: 'fan fan-clickable',
		tabindex: '0',
		role: 'button',
		'aria-label': `${seat.player} の手札 ${seat.hand.length}枚`,
	});
	for (let i = 0; i < Math.min(seat.hand.length, FANNED); i++) {
		fan.append(createCardSvg(null, 'card-sm'));
	}
	if (0 === seat.hand.length) {
		fan.append(createEmptySlot('card-sm'));
	}

	const tarot = el('div', { class: 'tarot-slot' },
		el('span', { class: 'slot-label' }, '切り札'),
		// ⚠ 他席の切り札は非公開。持っているかどうかだけが分かる。
		0 < seat.tarot.length ? createTarotCardImg(null, 'card-sm') : createEmptySlot('card-sm'));

	node.append(name, el('div', { class: 'hand-row' }, fan, tarot));
	return node;
}

function updateTable(next) {
	table = next;
	const opponents = qs('#opponents');
	const others = table.seats.filter((seat) => seat.pid !== pid);

	opponents.replaceChildren();
	others.forEach((seat, index) => {
		const node = createSeat(seat);
		placeSeat(node, index, others.length);
		opponents.append(node);
	});

	qs('#deckLabel').textContent = table.deck.length;
	qs('#deck').replaceChildren(
		0 < table.deck.length ? createCardSvg(null, 'card-lg') : createEmptySlot('card-lg'));

	qs('#pileLabel').textContent = table.pile.length;
	qs('#pile').replaceChildren(
		table.pile.card ? createCardSvg(table.pile.card, 'card-lg') : createEmptySlot('card-lg'));

	qs('#tarotDeckLabel').textContent = table.tarotDeck.length;
	qs('#tarotDeck').replaceChildren(
		0 < table.tarotDeck.length ? createTarotCardImg(null, 'card-lg') : createEmptySlot('card-lg'));

	qs('#tarotPileLabel').textContent = table.tarotPile.length;
	qs('#tarotPile').replaceChildren(
		table.tarotPile.card ? createTarotCardImg(table.tarotPile.card, 'card-lg') : createEmptySlot('card-lg'));

	const mine = seatOf(pid);
	if (mine) {
		qs('#handLabel').textContent = mine.hand.length;
	}
}

async function fetchTable() {
	const data = await ajax('./games/' + gid + '/table', {
		method: 'GET',
		headers: { 'Authorization': `Bearer ${token}` },
	});
	updateStatus(JSON.stringify(data, null, 2));
	updateTable(data);
}

// ---- 自分の手札 ----

async function updateHand(hand) {
	try {
		if (undefined === hand) {
			const data = await ajax('./games/' + gid + '/players/' + pid, {
				method: 'GET',
				headers: { 'Authorization': `Bearer ${token}` },
			});
			updateStatus(JSON.stringify(data, null, 2));
			hand = data.hand;
		}
		const node = qs('#hand');
		node.replaceChildren();
		for (let i = 0; i < hand.length; i++) {
			const card = createCardSvg(hand.cards[i]);
			card.setAttribute('data-cid', i);
			card.classList.add('clickable');
			node.append(card);
		}
		if (0 === hand.length) {
			node.append(createEmptySlot());
		}
		qs('#handLabel').textContent = hand.length;
	} catch (error) {
		updateStatus(`${error.name}: ${error.message}`);
	}
}

// 自分の切り札だけは面を見せる。マスターは持たないので空スロット。
// 手放すのは自分が捨てたときだけなので、卓の更新では触らない。
async function fetchTarotHand() {
	myTarot = undefined;
	if (false === isMaster()) {
		const data = await ajax('./games/' + gid + '/tarot/players/' + pid, {
			method: 'GET',
			headers: { 'Authorization': `Bearer ${token}` },
		});
		updateStatus(JSON.stringify(data, null, 2));
		myTarot = data.hand.card;
	}
	const node = qs('#tarotHand');
	if (undefined === myTarot) {
		node.replaceChildren(createEmptySlot());
		return;
	}
	const card = createTarotCardImg(myTarot);
	card.classList.add('clickable');
	node.replaceChildren(card);
}

// ---- 席の選択 ----

delegate(playerModal.node, 'button', 'click', () => playerModal.toggle());

qs('#selectPlayer').addEventListener('click', selectPlayer);
async function selectPlayer() {
	try {
		const params = parseDataValue({
			pid: '#selectPlayerSelect',
		});
		token = await getToken(params.pid, ticket);
		pid = params.pid;
		removeOption('#passHandSelect', pid);
		await fetchTable();
		const player = seatOf(pid)?.player ?? '';
		qs('#playerLabel').textContent = player;
		qs('#playerTag').textContent = player;
		await updateHand();
		await fetchTarotHand();

		socket = createSocket();
		keepAlive();
	} catch (error) {
		updateStatus(`${error.name}: ${error.message}`);
	}
}

// ---- 自分の手札の操作 ----

delegate(handModal.node, 'button', 'click', () => handModal.toggle());

delegate(qs('#hand'), 'svg', 'click', function () {
	const clone = this.cloneNode(true);
	clone.classList.remove('clickable', 'card-sm');
	clone.classList.add('card-lg');
	qs('#handModalCard').replaceChildren(clone);
	handModal.toggle();
});

qs('#discardHand').addEventListener('click', discardHand);
async function discardHand() {
	try {
		const params = parseDataValue({
			cid: '#handModalCard svg',
		});
		const data = await ajax('./games/' + gid + '/players/' + pid + '/cards/' + params.cid + '/discard', {
			method: 'PUT',
			headers: { 'Authorization': `Bearer ${token}` },
		});
		updateStatus(JSON.stringify(data, null, 2));
		await updateHand(data.hand);
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
			headers: { 'Authorization': `Bearer ${token}` },
		});
		updateStatus(JSON.stringify(data, null, 2));
		await updateHand(data.hand);
	} catch (error) {
		updateStatus(`${error.name}: ${error.message}`);
	}
}

// ---- 他席 ----

delegate(seatModal.node, 'button', 'click', () => seatModal.toggle());

function openSeat(seatPid) {
	const seat = seatOf(seatPid);
	if (undefined === seat) {
		return;
	}
	seatModal.node.dataset.tid = seat.pid;
	qs('#seatModalName').textContent = `${seat.player} (${seat.hand.length})`;
	qs('#seatModalCard').replaceChildren(
		0 < seat.hand.length ? createCardSvg(null, 'card-lg') : createEmptySlot('card-lg'));
	qs('#pick').disabled = 0 === seat.hand.length;
	qs('#seatModalNote').textContent = 0 === seat.hand.length
		? '手札がない。'
		: '引く札は無作為に決まる。位置は指定できない。';
	seatModal.toggle();
}

delegate(qs('#opponents'), '.fan', 'click', function () {
	openSeat(this.closest('.seat').dataset.pid);
});
delegate(qs('#opponents'), '.fan', 'keydown', function (event) {
	if ('Enter' === event.key || ' ' === event.key) {
		event.preventDefault();
		openSeat(this.closest('.seat').dataset.pid);
	}
});

qs('#pick').addEventListener('click', pickHand);
async function pickHand() {
	try {
		const tid = seatModal.node.dataset.tid;
		const data = await ajax('./games/' + gid + '/players/' + pid + '/pick/' + tid, {
			method: 'PUT',
			headers: { 'Authorization': `Bearer ${token}` },
		});
		updateStatus(JSON.stringify(data, null, 2));
		await updateHand(data.hand);
	} catch (error) {
		updateStatus(`${error.name}: ${error.message}`);
	}
}

// ---- 山札 ----

delegate(deckModal.node, 'button', 'click', () => deckModal.toggle());

qs('#deck').addEventListener('click', () => {
	qs('#deckModalCard').replaceChildren(createCardSvg(null, 'card-lg'));
	deckModal.toggle();
});

qs('#drawDeck').addEventListener('click', drawDeck);
async function drawDeck() {
	try {
		const data = await ajax('./games/' + gid + '/players/' + pid + '/draw', {
			method: 'PUT',
			headers: { 'Authorization': `Bearer ${token}` },
		});
		updateStatus(JSON.stringify(data, null, 2));
		await updateHand(data.hand);
	} catch (error) {
		updateStatus(`${error.name}: ${error.message}`);
	}
}

qs('#discardDeck').addEventListener('click', discardDeck);
async function discardDeck() {
	try {
		const data = await ajax('./games/' + gid + '/deck/discard', {
			method: 'PUT',
			headers: { 'Authorization': `Bearer ${token}` },
		});
		updateStatus(JSON.stringify(data, null, 2));
	} catch (error) {
		updateStatus(`${error.name}: ${error.message}`);
	}
}

// ---- 捨て札 ----

delegate(pileModal.node, 'button', 'click', () => pileModal.toggle());

qs('#pile').addEventListener('click', () => {
	qs('#pileModalCard').replaceChildren(
		table?.pile.card ? createCardSvg(table.pile.card, 'card-lg') : createEmptySlot('card-lg'));
	pileModal.toggle();
});

qs('#recycleHand').addEventListener('click', recycleHand);
async function recycleHand() {
	try {
		const data = await ajax('./games/' + gid + '/players/' + pid + '/recycle', {
			method: 'PUT',
			headers: { 'Authorization': `Bearer ${token}` },
		});
		updateStatus(JSON.stringify(data, null, 2));
		await updateHand(data.hand);
	} catch (error) {
		updateStatus(`${error.name}: ${error.message}`);
	}
}

qs('#recycleDeck').addEventListener('click', recycleDeck);
async function recycleDeck() {
	try {
		const data = await ajax('./games/' + gid + '/deck/recycle', {
			method: 'PUT',
			headers: { 'Authorization': `Bearer ${token}` },
		});
		updateStatus(JSON.stringify(data, null, 2));
	} catch (error) {
		updateStatus(`${error.name}: ${error.message}`);
	}
}

qs('#shufflePile').addEventListener('click', shufflePile);
async function shufflePile() {
	try {
		const data = await ajax('./games/' + gid + '/pile/shuffle', {
			method: 'PUT',
			headers: { 'Authorization': `Bearer ${token}` },
		});
		updateStatus(JSON.stringify(data, null, 2));
	} catch (error) {
		updateStatus(`${error.name}: ${error.message}`);
	}
}

// ---- タロット山札（めくれるのはマスターだけ） ----

delegate(tarotDeckModal.node, 'button', 'click', () => tarotDeckModal.toggle());

qs('#tarotDeck').addEventListener('click', () => {
	qs('#tarotDeckModalCard').replaceChildren(createTarotCardImg(null, 'card-lg'));
	qs('#discardTarotDeck').disabled = false === isMaster();
	qs('#tarotDeckModalNote').textContent = isMaster()
		? 'めくった札はタロット捨て札に表で出る。'
		: 'めくれるのはマスターだけ。';
	tarotDeckModal.toggle();
});

qs('#discardTarotDeck').addEventListener('click', discardTarotDeck);
async function discardTarotDeck() {
	try {
		const data = await ajax('./games/' + gid + '/tarot/deck/discard', {
			method: 'PUT',
			headers: { 'Authorization': `Bearer ${token}` },
		});
		updateStatus(JSON.stringify(data, null, 2));
	} catch (error) {
		updateStatus(`${error.name}: ${error.message}`);
	}
}

// ---- 自分の切り札 ----

delegate(tarotHandModal.node, 'button', 'click', () => tarotHandModal.toggle());

delegate(qs('#tarotHand'), 'img', 'click', function () {
	const clone = this.cloneNode(true);
	clone.classList.remove('clickable');
	clone.classList.add('card-lg');
	qs('#tarotHandModalCard').replaceChildren(clone);
	tarotHandModal.toggle();
});

qs('#discardTarotHand').addEventListener('click', discardTarotHand);
async function discardTarotHand() {
	try {
		const data = await ajax('./games/' + gid + '/tarot/players/' + pid + '/discard', {
			method: 'PUT',
			headers: { 'Authorization': `Bearer ${token}` },
		});
		updateStatus(JSON.stringify(data, null, 2));
		await fetchTarotHand();
	} catch (error) {
		updateStatus(`${error.name}: ${error.message}`);
	}
}

// ---- タロット捨て札 ----

delegate(tarotPileModal.node, 'button', 'click', () => tarotPileModal.toggle());

qs('#tarotPile').addEventListener('click', () => {
	qs('#tarotPileModalCard').replaceChildren(
		table?.tarotPile.card
			? createTarotCardImg(table.tarotPile.card, 'card-lg')
			: createEmptySlot('card-lg'));
	tarotPileModal.toggle();
});

qs('#flipTarotPile').addEventListener('click', flipTarotPile);
async function flipTarotPile() {
	try {
		const data = await ajax('./games/' + gid + '/tarot/pile/flip', {
			method: 'PUT',
			headers: { 'Authorization': `Bearer ${token}` },
		});
		updateStatus(JSON.stringify(data, null, 2));
	} catch (error) {
		updateStatus(`${error.name}: ${error.message}`);
	}
}

// ---- ready ----

// ticket が無い／通らないときは、空の卓を描かずに理由を出して止める。
if (null === ticket) {
	qs('#gate').textContent = 'この URL では卓に入れない。マスターから渡された URL を開く。';
	qs('#gate').hidden = false;
	qs('#felt').hidden = true;
} else {
	try {
		const data = await join(ticket);
		gid = data.gid;
		qs('#gameLabel').textContent = data.gid;
		updateOptions('#selectPlayerSelect', data.players);
		updateOptions('#passHandSelect', data.players);
		playerModal.open();
	} catch (error) {
		qs('#gate').textContent = `卓に入れない（${error.message}）。`;
		qs('#gate').hidden = false;
		qs('#felt').hidden = true;
	}
}
