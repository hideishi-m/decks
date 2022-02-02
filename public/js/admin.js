/**
Copyright (c) 2022 Hidenori ISHIKAWA. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import { newGames } from "/js/decks.js";

function updateStatus(text) {
	$("#status").empty().append($("<pre />").text(text));
}

function parseDataValuesEach(settings) {
	const data = {};
	for (const [key, selector] of Object.entries(settings)) {
		data[key] = [];
		$(selector).each(function () {
			const value = undefined !== $(this).data(key) ? $(this).data(key) : $(this).val();
			if (value) {
				data[key].push(value);
			}
		});
		if (0 === data[key].length) {
			throw new Error(key + " is empty");
		}
	}
	return data;
}

function parseDataValue(settings) {
	const data = {};
	for (const [key, selector] of Object.entries(settings)) {
		data[key] = undefined !== $(selector).data(key) ? $(selector).data(key) : $(selector).val();
		if (false === /^\d+$/.test(data[key])) {
			throw new Error(key + " is empty");
		}
	}
	return data;
}

$(document).ready(async function () {
	const games = newGames();

	// #game
	function updateGames() {
		$("#game").empty();
		for (const id of games.keys()) {
			appendGame(id);
		}
	}
	function appendGame(id) {
		const game = games.get(id);
		$("#game").append($("<div />", {
			class: "col-3",
			["data-id"]: game.id
		}).text(game.id));
		$("#game").append($("<div />", {
			class: "col-9",
			["data-id"]: game.id
		}).text(Array.from(game.values())));
	}
	function removeGame(id) {
		$(`#game div[data-id="${id}"]`).each(function () {
			$(this).remove();
		});
	}

	// #deleteGameSelect
	function updateDeleteGame() {
		$("#deleteGameSelect").empty();
		for (const id of games.keys()) {
			appendDeleteGame(id);
		}
	}
	function appendDeleteGame(id) {
		$("#deleteGameSelect").append($("<option />", {
			value: id
		}).text(id));
	}
	function removeDeleteGame(id) {
		$(`#deleteGameSelect option[value="${id}"]`).remove();
	}

	// #newGame
    $("#newGame").click(newGame);

    async function newGame() {
		try {
			const params = parseDataValuesEach({
				players: "input[name^=players]"
			});
			const data = await games.add({
				players: params.players
			});
			updateStatus(JSON.stringify(data, null, 2));
			appendGame(data.id);
			appendDeleteGame(data.id);
		} catch (error) {
			updateStatus(`${error.name}: ${error.message}`);
		}
    }

	// #deleteGame
    $("#deleteGame").click(deleteGame);

    async function deleteGame() {
		try {
			const params = parseDataValue({
				id: "#deleteGameSelect"
			});
			const data = await games.delete(params.id);
			updateStatus(JSON.stringify(data, null, 2));
			removeGame(data.id);
			removeDeleteGame(data.id);
		} catch (error) {
			updateStatus(`${error.name}: ${error.message}`);
		}
    }

	// #players
	$(".add").click(function () {
		const html = $(".copy").html();
		$("#players").parent().append(html);
	});
	$("#players").parent().on("click", ".remove", function () {
		$(this).parents(".input-group").remove();
	});

	// ready
	try {
		const data = await games.update();
		updateStatus(JSON.stringify(data, null, 2));
		updateGames();
		updateDeleteGame();
	} catch (error) {
		updateStatus(`${error.name}: ${error.message}`);
	}
});
