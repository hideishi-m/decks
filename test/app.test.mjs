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
 * createApp() は logs/access.log-* を開くが、ディレクトリが無くても
 * stream の error listener が握るので、テスト側で用意する必要はない。
 */

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import http from 'node:http';

import { createApp } from '../app.mjs';

const PLAYERS = [ 'p1', 'p2' ];
const TAROTS = [ '4', '18' ];

let server;
let origin;
let emitter;
const seen = [];

before(async () => {
	emitter = new EventEmitter();
	// emitter は app が emit するだけなので、記録しておいて後で見る。
	for (const type of [ 'deck', 'pile', 'hand', 'tarot' ]) {
		emitter.on(type, (data) => seen.push({ type: type, data: data }));
	}
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

async function newGame() {
	const created = await call('POST', '/games', {
		body: { players: PLAYERS, tarots: TAROTS },
	});
	assert.equal(created.status, 200);
	return created.body.gid;
}

async function tokenFor(gid, pid) {
	const got = await call('POST', '/token', { body: { gid: gid, pid: pid } });
	assert.equal(got.status, 200);
	return got.body.token;
}

describe('GET /games/:gid/table', () => {
	it('卓の公開状態を返す', async () => {
		const gid = await newGame();
		const token = await tokenFor(gid, 1);
		const { status, body } = await call('GET', `/games/${gid}/table`, { token: token });

		assert.equal(status, 200);
		assert.equal(body.gid, gid);
		assert.deepEqual(Object.keys(body),
			[ 'gid', 'seats', 'deck', 'pile', 'tarotDeck', 'tarotPile' ]);
		assert.equal(body.seats.length, PLAYERS.length + 1);
		assert.deepEqual(body.seats[0],
			{ pid: '0', player: 'マスター', hand: { length: 4 }, tarot: { length: 0 } });
		assert.deepEqual(body.seats[1],
			{ pid: '1', player: 'p1', hand: { length: 4 }, tarot: { length: 1 } });
		assert.equal(body.deck.length, 2 * 52 + 2 - 3 * 4);
		assert.deepEqual(body.pile, { length: 0 });
		assert.equal(body.tarotDeck.length, 26);
	});

	it('⚠ 他人の手札の中身を返さない', async () => {
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

	it('gid の形式が不正なら 400', async () => {
		const gid = await newGame();
		const { status } = await call('GET', '/games/abc/table',
			{ token: await tokenFor(gid, 1) });

		assert.equal(status, 400);
	});
});

describe('既存ルートの回帰', () => {
	it('GET /version', async () => {
		const { status, body } = await call('GET', '/version');

		assert.equal(status, 200);
		assert.ok(body.version);
	});

	it('GET /games/:gid は席の名前を返す', async () => {
		const gid = await newGame();
		const { status, body } = await call('GET', `/games/${gid}`);

		assert.equal(status, 200);
		assert.deepEqual(body.players, [ 'マスター', ...PLAYERS ]);
	});

	it('⚠ 他人の pid の手札は 403 のまま', async () => {
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

	it('手札を捨てると pile イベントが飛ぶ', async () => {
		const gid = await newGame();
		const token = await tokenFor(gid, 1);
		const before = seen.length;

		await call('PUT', `/games/${gid}/players/1/cards/0/discard`, { token: token });

		const emitted = seen.slice(before);
		assert.equal(emitted.length, 1);
		assert.equal(emitted[0].type, 'pile');
		assert.equal(emitted[0].data.gid, gid);
		assert.equal(emitted[0].data.pid, '1');
		assert.equal(emitted[0].data.player, 'p1');
	});
});
