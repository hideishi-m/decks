/**
Copyright (c) 2022-2026 Hidenori ISHIKAWA. All rights reserved.

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
import { readFileSync } from 'node:fs';

import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
const { document } = dom.window;
globalThis.window = dom.window;
globalThis.document = document;

const { ajax, join, getToken, updateStatus, appendLog, appendOption, updateOptions,
	removeOption, parseDataValue, parsePlayerRows, qs, qsa } =
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

	it('マッチした全ての select に追加する', () => {
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

	it('全ての select から value 一致の option を消す', () => {
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

describe('parsePlayerRows', () => {
	// 名前と切り札の 1 行。tarot を省くと select の無い行になる。
	function row(name, tarot) {
		const select = undefined === tarot ? ''
			: `<select name="tarots[]"><option>タロットを選ぶ</option><option value="${tarot}" selected>${tarot}</option></select>`;
		return `<div class="row"><input name="players[]" value="${name}">${select}</div>`;
	}

	function rows() {
		return qsa('.row');
	}

	it('行ごとに名前と切り札を組にして読む', () => {
		html(row('p1', '4') + row('p2', '18'));

		assert.deepEqual(parsePlayerRows(rows()),
			{ players: [ 'p1', 'p2' ], tarots: [ '4', '18' ] });
	});

	it('名前が空の行は切り札ごと読まない', () => {
		// 名前と切り札を別々に集めると、p3 に空の行の切り札（9）が付いてしまう。
		html(row('p1', '4') + row('', '9') + row('p3', '18'));

		assert.deepEqual(parsePlayerRows(rows()),
			{ players: [ 'p1', 'p3' ], tarots: [ '4', '18' ] });
	});

	it('名前の前後の空白を除き、空白だけの名前は空として扱う', () => {
		html(row('  p1 ', '4') + row('   ', '9'));

		assert.deepEqual(parsePlayerRows(rows()),
			{ players: [ 'p1' ], tarots: [ '4' ] });
	});

	it('切り札の無い行は undefined を並べる', () => {
		html(row('p1'));

		assert.deepEqual(parsePlayerRows(rows()),
			{ players: [ 'p1' ], tarots: [ undefined ] });
	});

	it('1 行も読めなければ throw する', () => {
		html(row('', '4'));

		assert.throws(() => parsePlayerRows(rows()), /players is empty/);
		assert.throws(() => parsePlayerRows([]), /players is empty/);
	});

	it('admin.html の行を足す雛型（.copy）は読まない', () => {
		// admin.js と同じく、席の行が並ぶ箱の直下だけを読む。
		const page = readFileSync(new URL('../public/admin.html', import.meta.url), 'utf8');
		html(page.slice(page.indexOf('<body'), page.indexOf('</body>')).replace(/^<body[^>]*>/, ''));
		const box = qs('#players').parentElement;
		qs('.copy input[name^=players]').value = 'template';

		const params = parsePlayerRows(qsa(':scope > .input-group', box));

		assert.deepEqual(params.players, [ 'DEIRmen', 'Litzia', 'yuzuki' ]);
		assert.equal(params.tarots.length, params.players.length);
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
			/^Error: 404 Not Found$/);
	});

	it('サーバが理由を返していれば添える', async () => {
		globalThis.fetch = async () => ({
			ok: false,
			status: 400,
			statusText: 'Bad Request',
			json: async () => ({ error: { message: 'invalid value for players' } }),
		});

		await assert.rejects(() => ajax('./games', { method: 'POST' }),
			/^Error: 400 Bad Request: invalid value for players$/);
	});

	it('本文が JSON でなければ理由は添えない', async () => {
		globalThis.fetch = async () => ({
			ok: false,
			status: 502,
			statusText: 'Bad Gateway',
			json: async () => { throw new SyntaxError('Unexpected token <'); },
		});

		await assert.rejects(() => ajax('./games', { method: 'GET' }),
			/^Error: 502 Bad Gateway$/);
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

	it('pid だけを送る。卓を決めるのは入場券。', async () => {
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
