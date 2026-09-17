/**
Copyright (c) 2022-2026 Hidenori ISHIKAWA. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import { closeSync, fsyncSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const VERSION = 1;

// 卓の保存先。起動時に読み、終了時に書くだけで、操作ごとには書かない。
// 入場券と伏せた札が入るので、ファイルは所有者だけが読めるようにする。
export function createStore(dir) {
	const path = join(dir, 'games.json');

	// 無ければ空。読めない・形が違うときは投げる。空で起動すると、
	// 次の終了で壊れたファイルを空の卓で上書きして消してしまうため。
	function load() {
		let text;
		try {
			text = readFileSync(path, 'utf8');
		} catch (error) {
			if ('ENOENT' === error.code) {
				return [];
			}
			throw error;
		}
		const data = JSON.parse(text);
		if (VERSION !== data?.version || false === Array.isArray(data.games)) {
			throw new TypeError(`unsupported format (version ${data?.version})`);
		}
		return data.games;
	}

	// 一時ファイルに書き切ってから置き換える。途中で落ちても元のファイルは残る。
	function save(games) {
		const temp = `${path}.tmp`;
		// 前回の残りがあれば消す。作り直さないと権限が 0600 にならない。
		rmSync(temp, { force: true });
		const fd = openSync(temp, 'wx', 0o600);
		try {
			writeFileSync(fd, JSON.stringify({ version: VERSION, games: games }));
			fsyncSync(fd);
		} finally {
			closeSync(fd);
		}
		renameSync(temp, path);
	}

	return { path, load, save };
}
