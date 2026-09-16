/**
Copyright (c) 2022-2024 Hidenori ISHIKAWA. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/**
 * common.js のヘルパの契約。
 *
 * 期待値は jQuery 実装の意味論をそのまま写したもの。特に次の 3 点は
 * 素朴に querySelector へ置き換えると壊れるので、ここで固定しておく。
 *   - appendOption / removeOption / updateOptions は「マッチした全ての select」に効く
 *   - parseDataValue は data-<key> を優先し、無ければ value を見る
 *   - 対象が 1 つも無ければ throw する（黙って undefined を返さない）
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
const { document } = dom.window;
globalThis.window = dom.window;
globalThis.document = document;

const { ajax, join, getToken, updateStatus, appendLog, appendOption, updateOptions,
	removeOption, parseDataValue, parseDataValuesEach } =
	await import('../public/js/common.js');

function html(markup) {
	document.body.innerHTML = markup;
}

function optionsOf(selector) {
	return [ ...document.querySelectorAll(`${selector} option`) ]
		.map((option) => [ option.value, option.textContent ]);
}

describe('updateStatus', () => {
	beforeEach(() => html('<div id="status"></div>'));

	it('#status を pre 1 つで置き換える', () => {
		updateStatus('{"gid":"0"}');

		const status = document.querySelector('#status');
		assert.equal(status.children.length, 1);
		assert.equal(status.firstElementChild.tagName, 'PRE');
		assert.equal(status.firstElementChild.textContent, '{"gid":"0"}');
	});

	it('2 回目は追記ではなく置き換え', () => {
		updateStatus('古い');
		updateStatus('新しい');

		const status = document.querySelector('#status');
		assert.equal(status.children.length, 1);
		assert.equal(status.textContent, '新しい');
	});

	it('テキストとして入れる（HTML として解釈しない）', () => {
		updateStatus('<b>not markup</b>');

		assert.equal(document.querySelector('#status b'), null);
		assert.equal(document.querySelector('#status pre').textContent,
			'<b>not markup</b>');
	});
});

describe('appendLog', () => {
	beforeEach(() => html('<pre id="log"></pre>'));

	it('新しい行を先頭に積む', () => {
		appendLog('1 行目');
		appendLog('2 行目');

		assert.equal(document.querySelector('#log').textContent,
			'2 行目\n1 行目\n');
	});
});

describe('appendOption', () => {
	beforeEach(() => html(`
		<select class="t"></select>
		<select class="t"></select>
	`));

	it('⚠ マッチした全ての select に追加する', () => {
		// admin.js が select[name^=tarots] に対してこの前提で呼ぶ。
		// querySelector（単数）に置き換えると 1 つ目にしか入らない。
		appendOption('.t', '4', 'カブト');

		const selects = document.querySelectorAll('.t');
		assert.equal(selects.length, 2);
		for (const select of selects) {
			assert.equal(select.options.length, 1);
			assert.equal(select.options[0].value, '4');
			assert.equal(select.options[0].textContent, 'カブト');
		}
	});

	it('既存の option を消さずに足す', () => {
		html('<select class="t"><option value="0">既存</option></select>');
		appendOption('.t', '1', '追加');

		assert.deepEqual(optionsOf('.t'), [ [ '0', '既存' ], [ '1', '追加' ] ]);
	});

	it('マッチが無くても落ちない', () => {
		html('<div></div>');
		assert.doesNotThrow(() => appendOption('.t', '0', 'x'));
	});
});

describe('updateOptions', () => {
	beforeEach(() => html('<select class="t"><option value="9">古い</option></select>'));

	it('既存を消して配列の index を value にする', () => {
		updateOptions('.t', [ 'マスター', 'p1', 'p2' ]);

		assert.deepEqual(optionsOf('.t'), [
			[ '0', 'マスター' ], [ '1', 'p1' ], [ '2', 'p2' ],
		]);
	});

	it('空配列なら option が無くなる', () => {
		updateOptions('.t', []);

		assert.deepEqual(optionsOf('.t'), []);
	});
});

describe('removeOption', () => {
	beforeEach(() => html(`
		<select class="t">
			<option value="0">a</option><option value="1">b</option>
		</select>
		<select class="t">
			<option value="0">a</option><option value="1">b</option>
		</select>
	`));

	it('⚠ 全ての select から value 一致の option を消す', () => {
		removeOption('.t', '1');

		assert.deepEqual(optionsOf('.t'), [ [ '0', 'a' ], [ '0', 'a' ] ]);
	});

	it('一致が無ければ何もしない', () => {
		removeOption('.t', '7');

		assert.equal(document.querySelectorAll('.t option').length, 4);
	});
});

describe('parseDataValue', () => {
	it('data-<key> があればそれを読む', () => {
		html('<svg id="card" data-cid="2"></svg>');

		assert.deepEqual(parseDataValue({ cid: '#card' }), { cid: '2' });
	});

	it('data-<key> が無ければ value を読む', () => {
		html('<select id="s"><option value="3" selected>p3</option></select>');

		assert.deepEqual(parseDataValue({ pid: '#s' }), { pid: '3' });
	});

	it('data-<key> は value より優先する', () => {
		html('<select id="s" data-pid="1"><option value="3" selected>p3</option></select>');

		assert.deepEqual(parseDataValue({ pid: '#s' }), { pid: '1' });
	});

	it('複数のキーをまとめて読む', () => {
		html(`
			<svg id="card" data-cid="2"></svg>
			<select id="s"><option value="3" selected>p3</option></select>
		`);

		assert.deepEqual(parseDataValue({ cid: '#card', tid: '#s' }),
			{ cid: '2', tid: '3' });
	});

	it('数字でなければ throw する', () => {
		// 「Select player」のままのプレースホルダ option を弾くのがこの検査の役目。
		html('<select id="s"><option selected>Select player</option></select>');

		assert.throws(() => parseDataValue({ pid: '#s' }), /pid is empty/);
	});

	it('要素が 1 つも無ければ throw する', () => {
		html('<div></div>');

		assert.throws(() => parseDataValue({ gid: '#missing' }), /gid is empty/);
	});

	it('最初にマッチした要素だけを見る', () => {
		html('<span class="t" data-gid="1"></span><span class="t" data-gid="2"></span>');

		assert.deepEqual(parseDataValue({ gid: '.t' }), { gid: '1' });
	});
});

describe('parseDataValuesEach', () => {
	it('マッチした全ての要素から集める', () => {
		html(`
			<input class="p" value="DEIRmen">
			<input class="p" value="Litzia">
			<input class="p" value="yuzuki">
		`);

		assert.deepEqual(parseDataValuesEach({ players: '.p' }),
			{ players: [ 'DEIRmen', 'Litzia', 'yuzuki' ] });
	});

	it('⚠ 空の値は落とす', () => {
		// admin.html の .copy（新しい行のひな型）が空の input を持つので、
		// これが落ちないと空のプレーヤーが混ざる。
		html('<input class="p" value="p1"><input class="p" value=""><input class="p" value="p2">');

		assert.deepEqual(parseDataValuesEach({ players: '.p' }),
			{ players: [ 'p1', 'p2' ] });
	});

	it('data-<key> があればそれを読む', () => {
		html('<span class="p" data-players="x"></span>');

		assert.deepEqual(parseDataValuesEach({ players: '.p' }), { players: [ 'x' ] });
	});

	it('1 つも集まらなければ throw する', () => {
		html('<input class="p" value="">');

		assert.throws(() => parseDataValuesEach({ players: '.p' }), /players is empty/);
	});

	it('複数のキーをまとめて集める', () => {
		html(`
			<input class="p" value="p1"><select class="t"><option value="4" selected>カブト</option></select>
			<input class="p" value="p2"><select class="t"><option value="18" selected>マヤカシ</option></select>
		`);

		assert.deepEqual(parseDataValuesEach({ players: '.p', tarots: '.t' }),
			{ players: [ 'p1', 'p2' ], tarots: [ '4', '18' ] });
	});
});

describe('ajax', () => {
	it('ok なら JSON を返す', async () => {
		globalThis.fetch = async () => ({ ok: true, json: async () => ({ gid: '0' }) });

		assert.deepEqual(await ajax('./games', { method: 'GET' }), { gid: '0' });
	});

	it('ok でなければ status と statusText で throw する', async () => {
		globalThis.fetch = async () => ({ ok: false, status: 404, statusText: 'Not Found' });

		await assert.rejects(() => ajax('./games/9', { method: 'GET' }),
			/404 Not Found/);
	});
});

describe('join', () => {
	beforeEach(() => html('<div id="status"></div>'));

	it('入場券を Ticket として送り、卓と席を返す', async () => {
		let seen;
		globalThis.fetch = async (url, args) => {
			seen = { url: url, args: args };
			return { ok: true, json: async () => ({ gid: '0', players: [ 'マスター' ] }) };
		};

		const data = await join('abc');
		assert.equal(seen.url, './join');
		assert.equal(seen.args.method, 'GET');
		assert.equal(seen.args.headers.Authorization, 'Ticket abc');
		assert.deepEqual(data, { gid: '0', players: [ 'マスター' ] });
	});
});

describe('getToken', () => {
	beforeEach(() => html('<div id="status"></div>'));

	it('⚠ pid だけを送る。卓を決めるのは入場券。', async () => {
		let seen;
		globalThis.fetch = async (url, args) => {
			seen = { url: url, args: args };
			return { ok: true, json: async () => ({ token: 'jwt' }) };
		};

		assert.equal(await getToken(1, 'abc'), 'jwt');
		assert.equal(seen.url, './token');
		assert.equal(seen.args.method, 'POST');
		assert.equal(seen.args.headers.Authorization, 'Ticket abc');
		// 数値で呼ばれても文字列で送る（app.mjs の validateId が文字列を期待する）。
		assert.deepEqual(JSON.parse(seen.args.body), { pid: '1' });
	});

	it('取得した内容を #status に出す', async () => {
		globalThis.fetch = async () => ({ ok: true, json: async () => ({ token: 'jwt' }) });

		await getToken(1, 'abc');
		assert.match(document.querySelector('#status').textContent, /jwt/);
	});
});
