/**
Copyright (c) 2022-2024 Hidenori ISHIKAWA. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/**
 * HTTP レベルの検査。supertest は使わず、素の http サーバをポート 0 で起こして fetch で叩く。
 */

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import http from 'node:http';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createApp } from '../app.mjs';

const PLAYERS = [ 'p1', 'p2' ];
const TAROTS = [ '4', '18' ];

let server;
let origin;
let emitter;
const seen = [];

const LOG_DIR = fileURLToPath(new URL('../logs', import.meta.url));

// logs/ が無いときは空として扱う。ここで落とすと before ごと崩れ、
// 原因を言うべきテストではなく無関係なテストが一斉に落ちる。
function accessLogs() {
	if (false === existsSync(LOG_DIR)) {
		return [];
	}
	return readdirSync(LOG_DIR).filter((name) => name.startsWith('access.log-'));
}

// 消すのは createApp() が出した access.log-<日付> だけ。logs/ 自体は消さない
// —— 追跡されている logs/.gitkeep ごと消え、次の起動でログが書けなくなる。
function removeAccessLogs() {
	for (const name of accessLogs()) {
		rmSync(join(LOG_DIR, name));
	}
}

before(async () => {
	// 前回のアクセスログを片付けておく。
	removeAccessLogs();
	emitter = new EventEmitter();
	// emitter は app が emit するだけなので、記録しておいて後で見る。
	emitter.on('action', (data) => seen.push(data));
	server = http.createServer(createApp(emitter, { secret: 'test-secret' }));
	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
	origin = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
	server.close();
});

async function call(method, path, options) {
	const headers = {};
	if (options?.token) {
		headers.Authorization = `Bearer ${options.token}`;
	}
	if (options?.ticket) {
		headers.Authorization = `Ticket ${options.ticket}`;
	}
	if (options?.body) {
		headers['Content-Type'] = 'application/json';
	}
	const response = await fetch(`${origin}${path}`, {
		method: method,
		headers: headers,
		body: options?.body ? JSON.stringify(options.body) : undefined,
	});
	return { status: response.status, body: await response.json() };
}

// 卓を 1 つ作る。gid と入場券をまとめて覚えておく。
const ticketOf = new Map();

async function newGame() {
	const created = await call('POST', '/games', {
		body: { players: PLAYERS, mode: 'tarot', tarots: TAROTS },
	});
	assert.equal(created.status, 200);
	assert.ok(created.body.ticket, '卓を作ったら入場券が返る');
	ticketOf.set(created.body.gid, created.body.ticket);
	return created.body.gid;
}

async function tokenFor(gid, pid) {
	const got = await call('POST', '/token', {
		body: { pid: pid },
		ticket: ticketOf.get(gid),
	});
	assert.equal(got.status, 200);
	return got.body.token;
}

// 卓を作る。通れば入場券を覚えておく。
async function create(body) {
	const created = await call('POST', '/games', { body: body });
	if (200 === created.status) {
		ticketOf.set(created.body.gid, created.body.ticket);
	}
	return created;
}

describe('卓の種類（mode）', () => {
	it('mode は必須で、省略すると 400（既定値は無い）', async () => {
		// 古い呼び方（{ players, tarots }）が、黙って別の卓にならないこと。
		const created = await create({ players: PLAYERS, tarots: TAROTS });

		assert.equal(created.status, 400);
		assert.equal(created.body.error.message, 'invalid value for mode');
	});

	it('tarot の卓はエピタフを持たない', async () => {
		const created = await create({ players: PLAYERS, mode: 'tarot', tarots: TAROTS });

		assert.equal(created.status, 200);
		assert.equal(created.body.mode, 'tarot');
		assert.deepEqual(created.body.epitaphs, []);
	});

	it('none なら tarots を省略して作れる', async () => {
		const created = await create({ players: PLAYERS, mode: 'none' });
		const gid = created.body.gid;
		const got = await call('GET', `/games/${gid}`);
		const table = await call('GET', `/games/${gid}/table`,
			{ token: await tokenFor(gid, 1) });

		assert.equal(created.status, 200);
		assert.equal(created.body.mode, 'none');
		assert.equal(got.body.mode, 'none');
		assert.equal(table.body.mode, 'none');
		assert.equal(table.body.tarotDeck.length, 0);
		assert.equal(table.body.tarotPile.length, 0);
		assert.deepEqual(table.body.seats.map((seat) => seat.tarot.length),
			[ 0, 0, 0 ]);
		assert.deepEqual(table.body.epitaphs, []);
	});

	it('none と一緒に送られた tarots は使わない', async () => {
		const created = await create({ players: PLAYERS, tarots: TAROTS, mode: 'none' });
		const gid = created.body.gid;
		const hand = await call('GET', `/games/${gid}/tarot/players/1`,
			{ token: await tokenFor(gid, 1) });

		assert.equal(created.status, 200);
		assert.equal(hand.body.hand.length, 0);
	});

	it('タロットの卓でなければ、API を直に叩いてもタロットは出てこない', async () => {
		for (const body of [
			{ players: PLAYERS, mode: 'none' },
			{ players: PLAYERS, mode: 'epitaph', epitaphs: [ '1' ] },
		]) {
			const gid = (await create(body)).body.gid;
			const discarded = await call('PUT', `/games/${gid}/tarot/deck/discard`,
				{ token: await tokenFor(gid, 0) });

			assert.equal(discarded.status, 200);
			assert.equal(discarded.body.pile.length, 0);
			assert.equal(discarded.body.pile.card, undefined);
		}
	});

	it('タロットの卓では tarots は今までどおり必須', async () => {
		const created = await create({ players: PLAYERS, mode: 'tarot' });

		assert.equal(created.status, 400);
		assert.equal(created.body.error.message, 'invalid value for tarots');
	});

	it('タロットの卓では epitaphs を見ない', async () => {
		const created = await create({ players: PLAYERS, mode: 'tarot', tarots: TAROTS, epitaphs: 'x' });

		assert.equal(created.status, 200);
		assert.deepEqual(created.body.epitaphs, []);
	});

	for (const value of [ 'Tarot', 'epitaphs', '', 0, null, true, [] ]) {
		it(`mode が知らない値なら 400（${JSON.stringify(value)}）`, async () => {
			const created = await create({ players: PLAYERS, tarots: TAROTS, mode: value });

			assert.equal(created.status, 400);
			assert.deepEqual(created.body.error.cause.mode, value);
		});
	}
});

describe('エピタフの卓', () => {
	async function epitaphGame(epitaphs) {
		const created = await create({ players: PLAYERS, mode: 'epitaph', epitaphs: epitaphs });
		assert.equal(created.status, 200);
		return created.body.gid;
	}

	async function epitaphsOf(gid, pid) {
		const got = await call('GET', `/games/${gid}/epitaphs`,
			{ token: await tokenFor(gid, pid) });
		assert.equal(got.status, 200);
		return got.body.epitaphs;
	}

	it('管理面には番号順の並びを返す', async () => {
		const created = await create({ players: PLAYERS, mode: 'epitaph', epitaphs: [ '24', '1', '12' ] });
		const got = await call('GET', `/games/${created.body.gid}`);

		assert.equal(created.status, 200);
		assert.deepEqual(Object.keys(created.body),
			[ 'gid', 'players', 'mode', 'epitaphs', 'ticket' ]);
		assert.equal(created.body.mode, 'epitaph');
		assert.deepEqual(created.body.epitaphs, [ '1', '12', '24' ]);
		assert.deepEqual(got.body, created.body);
	});

	it('0 枚でも作れる', async () => {
		const gid = await epitaphGame([]);
		const table = await call('GET', `/games/${gid}/table`,
			{ token: await tokenFor(gid, 1) });

		assert.equal(table.body.mode, 'epitaph');
		assert.deepEqual(table.body.epitaphs, []);
	});

	for (const value of [ undefined, '1', [ '0' ], [ '32' ], [ 1 ], [ '1', '1' ], [ null ] ]) {
		it(`epitaphs が不正なら 400（${JSON.stringify(value)}）`, async () => {
			const created = await create({ players: PLAYERS, mode: 'epitaph', epitaphs: value });

			assert.equal(created.status, 400);
			assert.deepEqual(created.body.error.cause.epitaphs, value);
		});
	}

	it('タロットは使わず、tarots が来ても使わない', async () => {
		const created = await create({
			players: PLAYERS, mode: 'epitaph', epitaphs: [ '1' ], tarots: TAROTS,
		});
		const gid = created.body.gid;
		const table = await call('GET', `/games/${gid}/table`,
			{ token: await tokenFor(gid, 1) });

		assert.equal(created.status, 200);
		assert.equal(table.body.tarotDeck.length, 0);
		assert.deepEqual(table.body.seats.map((seat) => seat.tarot.length),
			[ 0, 0, 0 ]);
	});

	it('卓の公開状態に裏の札の番号を出さない', async () => {
		const gid = await epitaphGame([ '1', '12' ]);
		const table = await call('GET', `/games/${gid}/table`,
			{ token: await tokenFor(gid, 1) });

		assert.deepEqual(table.body.epitaphs, [ { open: false }, { open: false } ]);
		assert.equal(JSON.stringify(table.body).includes('"rank"'), false);
	});

	it('GET /epitaphs はマスターにだけ裏の番号を返す', async () => {
		const gid = await epitaphGame([ '1', '12' ]);

		assert.deepEqual(await epitaphsOf(gid, 0),
			[ { open: false, rank: '1' }, { open: false, rank: '12' } ]);
		assert.deepEqual(await epitaphsOf(gid, 1),
			[ { open: false }, { open: false } ]);
	});

	it('マスターが表にすると、全員に番号が見える', async () => {
		const gid = await epitaphGame([ '1', '12', '24' ]);
		const opened = await call('PUT', `/games/${gid}/epitaphs/1/open`,
			{ token: await tokenFor(gid, 0) });

		assert.equal(opened.status, 200);
		assert.deepEqual(opened.body.epitaphs, [
			{ open: false, rank: '1' },
			{ open: true, rank: '12' },
			{ open: false, rank: '24' },
		]);
		assert.deepEqual(await epitaphsOf(gid, 2),
			[ { open: false }, { open: true, rank: '12' }, { open: false }]);
	});

	it('マスターが裏にすると、また隠れる', async () => {
		const gid = await epitaphGame([ '1', '12' ]);
		const token = await tokenFor(gid, 0);

		await call('PUT', `/games/${gid}/epitaphs/0/open`, { token: token });
		const closed = await call('PUT', `/games/${gid}/epitaphs/0/close`, { token: token });

		assert.equal(closed.status, 200);
		assert.deepEqual(await epitaphsOf(gid, 1), [ { open: false }, { open: false } ]);
	});

	it('表にする・裏にするを繰り返しても同じ状態に落ち着く', async () => {
		const gid = await epitaphGame([ '1' ]);
		const token = await tokenFor(gid, 0);

		await call('PUT', `/games/${gid}/epitaphs/0/open`, { token: token });
		await call('PUT', `/games/${gid}/epitaphs/0/open`, { token: token });
		assert.deepEqual(await epitaphsOf(gid, 1), [ { open: true, rank: '1' } ]);

		await call('PUT', `/games/${gid}/epitaphs/0/close`, { token: token });
		await call('PUT', `/games/${gid}/epitaphs/0/close`, { token: token });
		assert.deepEqual(await epitaphsOf(gid, 1), [ { open: false } ]);
	});

	for (const turn of [ 'open', 'close' ]) {
		it(`プレーヤーは ${turn} できない（403）`, async () => {
			const gid = await epitaphGame([ '1' ]);
			const turned = await call('PUT', `/games/${gid}/epitaphs/0/${turn}`,
				{ token: await tokenFor(gid, 1) });

			assert.equal(turned.status, 403);
			assert.deepEqual(await epitaphsOf(gid, 0), [ { open: false, rank: '1' } ]);
		});

		it(`${turn}: 並びの外は 404、形が不正なら 400、トークンが無ければ 401`, async () => {
			const gid = await epitaphGame([ '1' ]);
			const token = await tokenFor(gid, 0);

			assert.equal((await call('PUT', `/games/${gid}/epitaphs/1/${turn}`, { token: token })).status, 404);
			assert.equal((await call('PUT', `/games/${gid}/epitaphs/x/${turn}`, { token: token })).status, 400);
			assert.equal((await call('PUT', `/games/${gid}/epitaphs/0/${turn}`)).status, 401);
		});
	}

	it('タロットの卓では並びが空', async () => {
		const gid = await newGame();

		assert.deepEqual(await epitaphsOf(gid, 0), []);
		const opened = await call('PUT', `/games/${gid}/epitaphs/0/open`,
			{ token: await tokenFor(gid, 0) });
		assert.equal(opened.status, 404);
	});
});

describe('GET /games/:gid/table', () => {
	it('卓の公開状態を返す', async () => {
		const gid = await newGame();
		const token = await tokenFor(gid, 1);
		const { status, body } = await call('GET', `/games/${gid}/table`, { token: token });

		assert.equal(status, 200);
		assert.equal(body.gid, gid);
		assert.deepEqual(Object.keys(body),
			[ 'gid', 'mode', 'seats', 'deck', 'pile', 'tarotDeck', 'tarotPile', 'epitaphs' ]);
		assert.equal(body.mode, 'tarot');
		assert.equal(body.seats.length, PLAYERS.length + 1);
		assert.deepEqual(body.seats[0],
			{ pid: '0', player: 'マスター', hand: { length: 4 }, tarot: { length: 0 } });
		assert.deepEqual(body.seats[1],
			{ pid: '1', player: 'p1', hand: { length: 4 }, tarot: { length: 1 } });
		assert.equal(body.deck.length, 2 * 52 + 2 - 3 * 4);
		assert.deepEqual(body.pile, { length: 0 });
		assert.equal(body.tarotDeck.length, 26);
	});

	it('他人の手札の中身を返さない', async () => {
		const gid = await newGame();
		const token = await tokenFor(gid, 1);
		const { body } = await call('GET', `/games/${gid}/table`, { token: token });
		const json = JSON.stringify(body);

		assert.equal(json.includes('"suit"'), false);
		assert.equal(json.includes('"rank"'), false);
		assert.equal(json.includes('"cards"'), false);
	});

	it('どの席のトークンでも同じ内容を返す', async () => {
		const gid = await newGame();
		const first = await call('GET', `/games/${gid}/table`,
			{ token: await tokenFor(gid, 0) });
		const second = await call('GET', `/games/${gid}/table`,
			{ token: await tokenFor(gid, 2) });

		assert.deepEqual(first.body, second.body);
	});

	it('場が動いたら追随する', async () => {
		const gid = await newGame();
		const token = await tokenFor(gid, 1);

		await call('PUT', `/games/${gid}/players/1/cards/0/discard`, { token: token });
		const { body } = await call('GET', `/games/${gid}/table`, { token: token });

		assert.equal(body.seats[1].hand.length, 3);
		assert.equal(body.pile.length, 1);
		assert.ok(body.pile.card.suit);
	});

	it('切り札を捨てると席が 0 になり、捨て札に表で出る', async () => {
		const gid = await newGame();
		const token = await tokenFor(gid, 1);

		await call('PUT', `/games/${gid}/tarot/players/1/discard`, { token: token });
		const { body } = await call('GET', `/games/${gid}/table`, { token: token });

		assert.equal(body.seats[1].tarot.length, 0);
		assert.equal(body.tarotPile.length, 1);
		assert.equal(body.tarotPile.card.rank, '4');
	});

	it('トークンが無ければ 401', async () => {
		const gid = await newGame();
		const { status, body } = await call('GET', `/games/${gid}/table`);

		assert.equal(status, 401);
		assert.match(body.error.message, /authorization required/);
	});

	it('別のゲームのトークンなら 403', async () => {
		const gid = await newGame();
		const other = await newGame();
		const { status, body } = await call('GET', `/games/${gid}/table`,
			{ token: await tokenFor(other, 1) });

		assert.equal(status, 403);
		assert.match(body.error.message, /authorization failed for gid/);
	});

	it('存在しないゲームなら 404', async () => {
		const gid = await newGame();
		const { status } = await call('GET', '/games/9999/table',
			{ token: await tokenFor(gid, 1) });

		assert.equal(status, 404);
	});

	it('トークン無しでは席の数も手札の枚数も測れない', async () => {
		// app.param に席とカードの検査を置くと、404 と 401 の差で測れてしまう。
		const gid = await newGame();

		for (const path of [
			`/games/${gid}/players/1`,
			`/games/${gid}/players/9999`,
			`/games/${gid}/players/1/cards/0`,
			`/games/${gid}/players/1/cards/9999`,
		]) {
			const { status } = await call('GET', path);
			assert.equal(status, 401, `${path} は 401 で揃うこと`);
		}
	});

	it('gid の形式が不正なら 400', async () => {
		const gid = await newGame();
		const { status } = await call('GET', '/games/abc/table',
			{ token: await tokenFor(gid, 1) });

		assert.equal(status, 400);
	});
});

describe('入場（ticket）', () => {
	it('卓を作ると入場券が 1 つ返る', async () => {
		const created = await call('POST', '/games', {
			body: { players: PLAYERS, mode: 'tarot', tarots: TAROTS },
		});

		assert.equal(created.status, 200);
		assert.match(created.body.ticket, /^[\w-]{20,}$/);
	});

	it('入場券は卓ごとに違う', async () => {
		const first = await call('POST', '/games', { body: { players: PLAYERS, mode: 'tarot', tarots: [] } });
		const second = await call('POST', '/games', { body: { players: PLAYERS, mode: 'tarot', tarots: [] } });

		assert.notEqual(first.body.ticket, second.body.ticket);
	});

	it('GET /join は入場券だけで卓と席を返す', async () => {
		const gid = await newGame();
		const { status, body } = await call('GET', '/join',
			{ ticket: ticketOf.get(gid) });

		assert.equal(status, 200);
		assert.equal(body.gid, gid);
		assert.deepEqual(body.players, [ 'マスター', ...PLAYERS ]);
	});

	it('入場券が無ければ 401', async () => {
		const { status, body } = await call('GET', '/join');

		assert.equal(status, 401);
		assert.match(body.error.message, /ticket required/);
	});

	it('通らない入場券は 401', async () => {
		const { status, body } = await call('GET', '/join', { ticket: 'not-a-ticket' });

		assert.equal(status, 401);
		assert.match(body.error.message, /ticket not accepted/);
	});

	it('Bearer を Ticket として使い回せない', async () => {
		const gid = await newGame();
		const token = await tokenFor(gid, 1);
		const { status } = await call('GET', '/join', { token: token });

		assert.equal(status, 401);
	});

	it('入場券なしでは席のトークンを作れない', async () => {
		const gid = await newGame();
		const { status } = await call('POST', '/token', { body: { pid: '1' } });

		assert.equal(status, 401);
		// gid を添えても通らない（卓を決めるのは入場券だけ）。
		const withGid = await call('POST', '/token', { body: { gid: gid, pid: '1' } });
		assert.equal(withGid.status, 401);
	});

	it('別の卓の入場券では、その卓のトークンしか出ない', async () => {
		const first = await newGame();
		const second = await newGame();
		const token = await tokenFor(second, 1);

		// second の入場券で作ったトークンは first では通らない。
		const { status } = await call('GET', `/games/${first}/table`, { token: token });
		assert.equal(status, 403);
	});

	it('存在しない席のトークンは作れない', async () => {
		const gid = await newGame();
		const { status, body } = await call('POST', '/token', {
			body: { pid: '9999' },
			ticket: ticketOf.get(gid),
		});

		assert.equal(status, 404);
		assert.match(body.error.message, /player not found for pid/);
	});

	it('卓を消すと入場券も通らなくなる', async () => {
		const gid = await newGame();
		const ticket = ticketOf.get(gid);

		await call('DELETE', `/games/${gid}`);
		const { status } = await call('GET', '/join', { ticket: ticket });

		assert.equal(status, 401);
	});
});

describe('既存ルートの回帰', () => {
	it('アクセスログが logs/ に開いている', async () => {
		// createApp() は logs/ を作らない。追跡された logs/.gitkeep で
		// clone した時点から在る状態にしてあるので、それが消えると
		// morgan の書き込み先が開けず、エラーも出ないままログだけが残らなくなる。
		assert.equal(existsSync(join(LOG_DIR, '.gitkeep')), true);
		assert.equal(accessLogs().length, 1);
	});

	it('GET /version', async () => {
		const { status, body } = await call('GET', '/version');

		assert.equal(status, 200);
		assert.ok(body.version);
	});

	it('GET /games は gid だけを返す（管理面）', async () => {
		const gid = await newGame();
		const { status, body } = await call('GET', '/games');

		assert.equal(status, 200);
		const found = body.games.find((game) => game.gid === gid);
		// 席も入場券も載せない。応答が卓の中身に比例しないようにするため。
		assert.deepEqual(Object.keys(found), [ 'gid' ]);
	});

	it('GET /games は入場券を漏らさない', async () => {
		await newGame();
		const { body } = await call('GET', '/games');

		const tickets = [ ...ticketOf.values() ];
		const listed = JSON.stringify(body);
		assert.ok(tickets.length > 0);
		for (const ticket of tickets) {
			assert.equal(listed.includes(ticket), false);
		}
	});

	it('POST /games は GET /games/:gid と同じ形を返す', async () => {
		const created = await call('POST', '/games', {
			body: { players: PLAYERS, mode: 'tarot', tarots: TAROTS },
		});
		const got = await call('GET', `/games/${created.body.gid}`);

		assert.deepEqual(Object.keys(created.body), [ 'gid', 'players', 'mode', 'epitaphs', 'ticket' ]);
		assert.deepEqual(created.body, got.body);
	});

	it('GET /games/:gid は席と入場券を返す', async () => {
		const gid = await newGame();
		const { status, body } = await call('GET', `/games/${gid}`);

		assert.equal(status, 200);
		assert.deepEqual(Object.keys(body), [ 'gid', 'players', 'mode', 'epitaphs', 'ticket' ]);
		assert.deepEqual(body.players, [ 'マスター', ...PLAYERS ]);
		assert.equal(body.ticket, ticketOf.get(gid));
	});

	it('消した卓は一覧から消える', async () => {
		const gid = await newGame();
		await call('DELETE', `/games/${gid}`);
		const { body } = await call('GET', '/games');

		assert.equal(body.games.find((game) => game.gid === gid), undefined);
	});

	it('他人の pid の手札は 403 のまま', async () => {
		// /table を足しても、個別の手札は自分のものしか読めない。
		const gid = await newGame();
		const token = await tokenFor(gid, 1);
		const { status, body } = await call('GET', `/games/${gid}/players/2`,
			{ token: token });

		assert.equal(status, 403);
		assert.match(body.error.message, /authorization failed for pid/);
	});

	it('自分の手札は中身まで返る', async () => {
		const gid = await newGame();
		const token = await tokenFor(gid, 1);
		const { status, body } = await call('GET', `/games/${gid}/players/1`,
			{ token: token });

		assert.equal(status, 200);
		assert.equal(body.hand.cards.length, 4);
		assert.ok(body.hand.cards[0].suit);
	});

});

describe('WebSocket へ流す action', () => {
	// 1 操作 = 1 メッセージ。呼び出しの直後に積まれたものだけを見る。
	async function actionOf(method, path, token) {
		const before = seen.length;
		const response = await call(method, path, { token: token });
		const emitted = seen.slice(before);
		assert.equal(emitted.length, 1, `${path} が 1 件だけ emit すること`);
		return { action: emitted[0], response: response };
	}

	it('1 操作につき 1 件だけ流す', async () => {
		// 旧実装は deck/discard で deck と pile の 2 件を飛ばしていた。
		const gid = await newGame();
		const token = await tokenFor(gid, 0);

		await actionOf('PUT', `/games/${gid}/deck/discard`, token);
		await actionOf('PUT', `/games/${gid}/deck/recycle`, token);
		await actionOf('PUT', `/games/${gid}/pile/shuffle`, token);
	});

	it('エピタフの action は表にしたときだけ番号を載せる', async () => {
		const created = await create({ players: PLAYERS, mode: 'epitaph', epitaphs: [ '1', '12' ] });
		const gid = created.body.gid;
		const token = await tokenFor(gid, 0);

		const opened = await actionOf('PUT', `/games/${gid}/epitaphs/1/open`, token);
		assert.equal(opened.action.type, 'epitaph-open');
		assert.equal(opened.action.pid, '0');
		assert.deepEqual(opened.action.card, { eid: '1', open: true, rank: '12' });
		assert.deepEqual(opened.action.table.epitaphs,
			[ { open: false }, { open: true, rank: '12' } ]);

		const closed = await actionOf('PUT', `/games/${gid}/epitaphs/1/close`, token);
		assert.equal(closed.action.type, 'epitaph-close');
		assert.deepEqual(closed.action.card, { eid: '1', open: false });
		assert.equal(JSON.stringify(closed.action).includes('"rank"'), false);
	});

	it('封筒は seq / at / type / gid / pid / player / tid / target / card / table', async () => {
		const gid = await newGame();
		const token = await tokenFor(gid, 1);
		const { action } = await actionOf('PUT',
			`/games/${gid}/players/1/cards/0/discard`, token);

		assert.deepEqual(Object.keys(action), [
			'seq', 'at', 'type', 'gid', 'pid', 'player',
			'tid', 'target', 'card', 'table',
		]);
		assert.equal(action.type, 'discard');
		assert.equal(action.gid, gid);
		assert.equal(action.pid, '1');
		assert.equal(action.player, 'p1');
		assert.equal(action.tid, null);
		assert.equal(action.target, null);
		assert.ok(Date.parse(action.at));
	});

	it('seq はゲームごとに 1 から増える', async () => {
		const first = await newGame();
		const second = await newGame();
		const firstToken = await tokenFor(first, 0);
		const secondToken = await tokenFor(second, 0);

		const a = await actionOf('PUT', `/games/${first}/deck/discard`, firstToken);
		const b = await actionOf('PUT', `/games/${first}/deck/discard`, firstToken);
		const c = await actionOf('PUT', `/games/${second}/deck/discard`, secondToken);

		assert.equal(a.action.seq, 1);
		assert.equal(b.action.seq, 2);
		// 別のゲームの操作で番号が飛ばない（飛びを欠落の合図に使えるように）。
		assert.equal(c.action.seq, 1);
	});

	it('table は GET /table と同じ内容', async () => {
		const gid = await newGame();
		const token = await tokenFor(gid, 1);
		const { action } = await actionOf('PUT',
			`/games/${gid}/players/1/cards/0/discard`, token);
		const { body } = await call('GET', `/games/${gid}/table`, { token: token });

		const table = { ...body };
		delete table.gid;
		// emitter には生の Card が乗る。WebSocket は送信時に JSON へ直すので、
		// ワイヤ上の形に揃えてから比べる（sendToWebSockets の JSON.stringify 相当）。
		assert.deepEqual(JSON.parse(JSON.stringify(action.table)), table);
	});

	it('トークンだけの操作でも誰がやったか分かる', async () => {
		// deck/discard は :pid を取らないので、旧実装では player が出なかった。
		const gid = await newGame();
		const { action } = await actionOf('PUT', `/games/${gid}/deck/discard`,
			await tokenFor(gid, 2));

		assert.equal(action.pid, '2');
		assert.equal(action.player, 'p2');
	});

	it('pass と pick は相手を載せる', async () => {
		const gid = await newGame();
		const pass = await actionOf('PUT', `/games/${gid}/players/1/cards/0/pass/2`,
			await tokenFor(gid, 1));
		assert.equal(pass.action.type, 'pass');
		assert.equal(pass.action.tid, '2');
		assert.equal(pass.action.target, 'p2');

		const pick = await actionOf('PUT', `/games/${gid}/players/1/pick/2`,
			await tokenFor(gid, 1));
		assert.equal(pick.action.type, 'pick');
		assert.equal(pick.action.tid, '2');
		assert.equal(pick.action.target, 'p2');
	});

	it('伏せたままの札は card に載せない', async () => {
		const gid = await newGame();
		const token = await tokenFor(gid, 1);

		// 引く・渡す・抜く・山札へ戻す は札が見えないままなので card は null。
		const draw = await actionOf('PUT', `/games/${gid}/players/1/draw`, token);
		assert.equal(draw.action.card, null);

		const pass = await actionOf('PUT', `/games/${gid}/players/1/cards/0/pass/2`, token);
		assert.equal(pass.action.card, null);

		const pick = await actionOf('PUT', `/games/${gid}/players/1/pick/2`, token);
		assert.equal(pick.action.card, null);

		await call('PUT', `/games/${gid}/deck/discard`, { token: token });
		const back = await actionOf('PUT', `/games/${gid}/deck/recycle`, token);
		assert.equal(back.action.card, null);
	});

	it('場に表で出た札は card に載せる', async () => {
		const gid = await newGame();
		const token = await tokenFor(gid, 1);

		const discard = await actionOf('PUT',
			`/games/${gid}/players/1/cards/0/discard`, token);
		assert.ok(discard.action.card.suit);
		assert.deepEqual(discard.action.card, discard.action.table.pile.card);

		const flipped = await actionOf('PUT', `/games/${gid}/deck/discard`, token);
		assert.deepEqual(flipped.action.card, flipped.action.table.pile.card);

		const taken = await actionOf('PUT', `/games/${gid}/players/1/recycle`, token);
		assert.equal(taken.action.type, 'recycle');
		assert.ok(taken.action.card.suit);
	});

	it('recycle は捨て札を実際に手札へ移す', async () => {
		// emit を足すときに hand.recycle() を落としかけた箇所。
		const gid = await newGame();
		const token = await tokenFor(gid, 1);

		await call('PUT', `/games/${gid}/players/1/cards/0/discard`, { token: token });
		const before = await call('GET', `/games/${gid}/table`, { token: token });
		const { body } = await call('PUT', `/games/${gid}/players/1/recycle`,
			{ token: token });

		assert.equal(before.body.seats[1].hand.length, 3);
		assert.equal(body.hand.length, 4);
		assert.equal(body.pile.length, 0);
	});

	it('タロットの 3 操作も action になる', async () => {
		const gid = await newGame();
		const master = await tokenFor(gid, 0);

		const discarded = await actionOf('PUT', `/games/${gid}/tarot/players/1/discard`,
			await tokenFor(gid, 1));
		assert.equal(discarded.action.type, 'tarot-discard');
		assert.equal(discarded.action.card.rank, '4');
		assert.equal(discarded.action.table.seats[1].tarot.length, 0);

		const flipped = await actionOf('PUT', `/games/${gid}/tarot/pile/flip`, master);
		assert.equal(flipped.action.type, 'tarot-flip');
		assert.equal(flipped.action.card.position, 'R');

		const turned = await actionOf('PUT', `/games/${gid}/tarot/deck/discard`, master);
		assert.equal(turned.action.type, 'tarot-deck-discard');
		assert.ok(turned.action.card.rank);
	});

	it('GET は何も流さない', async () => {
		const gid = await newGame();
		const token = await tokenFor(gid, 1);
		const before = seen.length;

		await call('GET', `/games/${gid}/table`, { token: token });
		await call('GET', `/games/${gid}/deck`, { token: token });
		await call('GET', `/games/${gid}/players/1`, { token: token });

		assert.equal(seen.length, before);
	});
});
