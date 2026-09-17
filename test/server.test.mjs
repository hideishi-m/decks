/**
Copyright (c) 2022-2026 Hidenori ISHIKAWA. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/**
 * WebSocket の配信。接続を identity で束ねていないことを見る。
 */

import { after, before, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { WebSocket } from 'ws';

import * as store from '../store.mjs';

const PLAYERS = [ 'p1', 'p2' ];
const SETTLE = 300;

let server;
let port;
let emitter;
// close で卓が書き出される。app.mjs は保存先を ./data に決め打ちにしているので、
// store.mjs を差し替えて、リポジトリの data/ ではなく使い捨ての場所へ向ける。
// 差し替えには --experimental-test-module-mocks が要る（npm test に付けてある）。
const DATA_DIR = mkdtempSync(join(tmpdir(), 'decks-server-'));
mock.module('../store.mjs', {
	namedExports: {
		createStore: () => store.createStore(DATA_DIR),
	},
});
// 差し替えた後に読み込む。先に読み込むと本物の store.mjs を掴む。
const { createServer } = await import('../server.mjs');

before(async () => {
	emitter = new EventEmitter();
	server = createServer(emitter, { secret: 'test-secret' });
	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
	port = server.address().port;
});

after(() => {
	emitter.emit('close');
	rmSync(DATA_DIR, { recursive: true, force: true });
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
	const response = await fetch(`http://127.0.0.1:${port}${path}`, {
		method: method,
		headers: headers,
		body: options?.body ? JSON.stringify(options.body) : undefined,
	});
	return { status: response.status, body: await response.json() };
}

async function newGame() {
	const created = await call('POST', '/games', {
		body: { players: PLAYERS, mode: 'tarot', tarots: [] },
	});
	return created.body;
}

function settle(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms ?? SETTLE));
}

// 繋いで名乗り、受け取ったメッセージを溜める。
function connect(gid, pid, token) {
	const socket = new WebSocket(`ws://127.0.0.1:${port}`);
	socket.received = [];
	socket.on('message', (data) => {
		const text = data.toString();
		if ('' !== text) {
			socket.received.push(JSON.parse(text));
		}
	});
	socket.on('open', () => socket.send(JSON.stringify({
		gid: gid,
		pid: pid,
		token: token,
	})));
	return new Promise((resolve) => socket.on('open', () => resolve(socket)));
}

async function seat(game, pid) {
	const got = await call('POST', '/token', {
		body: { pid: pid },
		ticket: game.ticket,
	});
	return got.body.token;
}

describe('WebSocket の配信', () => {
	it('同じ席を 2 つ開いても両方に届く', async () => {
		// 接続を {gid, pid, ip} で束ねると後勝ちで上書きされ、
		// 先に開いた方は open のまま何も受け取らなくなる。
		const game = await newGame();
		const token = await seat(game, '1');
		const other = await seat(game, '2');

		const first = await connect(game.gid, '1', token);
		const second = await connect(game.gid, '1', token);
		await settle();

		await call('PUT', `/games/${game.gid}/deck/discard`, { token: other });
		await settle();

		assert.equal(first.received.length, 1, '先に開いた方にも届くこと');
		assert.equal(second.received.length, 1);
		assert.equal(first.readyState, WebSocket.OPEN);

		first.terminate();
		second.terminate();
	});

	it('同じ卓の全員に届く', async () => {
		const game = await newGame();
		const master = await connect(game.gid, '0', await seat(game, '0'));
		const one = await connect(game.gid, '1', await seat(game, '1'));
		const two = await connect(game.gid, '2', await seat(game, '2'));
		await settle();

		await call('PUT', `/games/${game.gid}/deck/discard`,
			{ token: await seat(game, '0') });
		await settle();

		// 自分の操作も返ってくる。
		assert.equal(master.received.length, 1);
		assert.equal(one.received.length, 1);
		assert.equal(two.received.length, 1);
		assert.equal(one.received[0].action.type, 'deck-discard');

		for (const socket of [ master, one, two ]) {
			socket.terminate();
		}
	});

	it('別の卓には届かない', async () => {
		const mine = await newGame();
		const other = await newGame();
		const listener = await connect(other.gid, '1', await seat(other, '1'));
		await settle();

		await call('PUT', `/games/${mine.gid}/deck/discard`,
			{ token: await seat(mine, '1') });
		await settle();

		assert.equal(listener.received.length, 0);

		listener.terminate();
	});

	it('名乗らない接続には届かない', async () => {
		const game = await newGame();
		const silent = new WebSocket(`ws://127.0.0.1:${port}`);
		silent.received = [];
		silent.on('message', (data) => {
			if ('' !== data.toString()) {
				silent.received.push(data.toString());
			}
		});
		await new Promise((resolve) => silent.on('open', resolve));
		await settle();

		await call('PUT', `/games/${game.gid}/deck/discard`,
			{ token: await seat(game, '1') });
		await settle();

		assert.equal(silent.received.length, 0);

		silent.terminate();
	});

	it('通らないトークンは切られる', async () => {
		const game = await newGame();
		const socket = new WebSocket(`ws://127.0.0.1:${port}`);
		await new Promise((resolve) => socket.on('open', resolve));
		socket.send(JSON.stringify({ gid: game.gid, pid: '1', token: 'not-a-token' }));

		await new Promise((resolve) => socket.on('close', resolve));
		assert.equal(socket.readyState, WebSocket.CLOSED);
	});

	it('JSON でない名乗りは切られ、サーバは動き続ける', async () => {
		// JSON.parse の例外を拾わないと、未捕捉のままプロセスごと落ちる。
		// 入場券もトークンも要らないので、誰でも全卓を消せてしまう。
		const socket = new WebSocket(`ws://127.0.0.1:${port}`);
		await new Promise((resolve) => socket.on('open', resolve));
		socket.send('not json');
		await settle();

		assert.equal(socket.readyState, WebSocket.CLOSED);

		const game = await newGame();
		const listener = await connect(game.gid, '1', await seat(game, '1'));
		await settle();

		assert.equal(listener.readyState, WebSocket.OPEN);

		listener.terminate();
	});

	it('上限を超える名乗りは切られる', async () => {
		// 正しいトークンでも、大きすぎるメッセージは読む前に ws が切る（1009）。
		const game = await newGame();
		const socket = new WebSocket(`ws://127.0.0.1:${port}`);
		const code = new Promise((resolve) => socket.on('close', resolve));
		await new Promise((resolve) => socket.on('open', resolve));
		socket.send(JSON.stringify({
			gid: game.gid,
			pid: '1',
			token: await seat(game, '1'),
			padding: 'x'.repeat(4 * 1024),
		}));
		await settle();

		assert.equal(socket.readyState, WebSocket.CLOSED);
		assert.equal(await code, 1009);
	});

	it('空文字は生存確認としてそのまま返る', async () => {
		const game = await newGame();
		const socket = await connect(game.gid, '1', await seat(game, '1'));
		await settle();

		const pong = new Promise((resolve) => socket.once('message', (data) => resolve(data.toString())));
		socket.send('');

		assert.equal(await pong, '');

		socket.terminate();
	});
});
