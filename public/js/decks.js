/**
Copyright (c) 2022 Hidenori ISHIKAWA. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

async function ajax(url, args) {
	const response = await fetch(url, args);
	if (false === response.ok) {
		throw new Error(`${response.status} ${response.statusText}`);
	}
	return await response.json();
}

class Games {
	constructor() {
		this.games = new Map();
	}

	get(id) {
		return this.games.get(id);
	}

	keys() {
		return this.games.keys();
	}

	async update() {
		const data = await ajax('/games', { method: 'GET' });
		for (const id of data.games) {
			this.games.set(id, await newGame(id));
		}
		return data;
	}

	async add(json) {
		const data = await ajax('/games', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			cache: 'no-cache',
			body: JSON.stringify(json)
		});
		this.games.set(data.id, await newGame(data.id));
		return data;
	}

	async delete(id) {
		const data = await ajax('/games/' + id, { method: 'DELETE' } );
		this.games.delete(data.id);
		return data;
	}
}

class Game {
	constructor(id, players) {
		this.id = id;
		this.players = new Map();
		for (let i = 0; i < players.length; i++) {
			this.players.set(i, players[i]);
		}
	}

	values() {
		return this.players.values();
	}
}

export function newGames() {
	return new Games();
}

async function newGame(id) {
	const data = await ajax('/games/' + id, { method: 'GET' });
	return new Game(data.id, data.players);
}
