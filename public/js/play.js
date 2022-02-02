/**
Copyright (c) 2022 Hidenori ISHIKAWA. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import { appendOption, updateStatus, parseDataValue, removeOption} from '/js/utils.js';

$(document).ready(function () {
	let id, pid;
	let gameModal, playerModal, handModal, deckModal, pileModal;

	const socket = new WebSocket(`ws://${document.location.host}`);
	socket.addEventListener('message', function (event) {
		console.log(event.data);
		parseMessage(event.data);
	});

	function logMessage(data) {
		const text = $("#log").text();
		$("#log").text(data + "\n" + text);
	}

	function parseMessage(data) {
		try {
			data = JSON.parse(data) ?? {};
			// hand: id,pid,player,tid
			if (data.hand) {
				logMessage(`${data.hand.player} picked a card from you`);
				getHand();
			}
			// deck: id,pid,player
			// deck: id
			else if (data.deck) {
				if (data.deck.player) {
					logMessage(`${data.deck.player} drew a card`);
					updateDeck(data.deck);
				} else {
					logMessage("deck was updated");
					updateDeck(data.deck);
				}
			}
			// pile: id,pid,player,pile
			// pile: id,pile
			else if (data.pile) {
				if (data.pile.player) {
					logMessage(`${data.pile.player} discarded a card`);
					updatePile(data.pile);
				} else {
					logMessage("pile was updated");
					updatePile(data.pile);
				}
			}
		} catch (error) {
			console.error(error);
		}
	}

	function getCardSvg(card) {
		let use;
		if (card) {
			const suits = { C: "club", D: "diamond", H: "heart", S: "spade" };
			const ranks = { A: "1", 0: "10", J: "jack", Q: "queen", K: "king", X: "joker_black" };
			const suit = suits[card.suit] ? (suits[card.suit] + "_") : "";
			const rank = ranks[card.rank] ?? card.rank;
			use = `<use href="/images/svg-cards.svg#${suit}${rank}" x="0" y="0" />`;
		} else {
			use = '<use href="/images/svg-cards.svg#back" x="0" y="0" fill="red" />';
		}
		return $(`<svg viewBox="0 0 169 245" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" >${use}</svg>`);
	}

	function updateSelectGame(data) {
		$("#selectGameSelect").empty();
		for (const game of data.games) {
			appendOption("#selectGameSelect", game, game);
		}
	}

	function updateSelectPlayer(data) {
		$("#selectPlayerSelect").empty();
		for (let i = 0; i < data.players.length; i++) {
			appendOption("#selectPlayerSelect", i, data.players[i]);
		}
	}

	function updateHand(data) {
		$("#hand").empty();
		for (let i = 0; i < data.hand.cards.length; i++) {
			$("#hand").append(
				$("<div />", { class: "col" }).append(
					getCardSvg(data.hand.cards[i]).attr("data-cid", i)
				)
			);
		}
	}

	function updateDeck(data) {
		$.ajax({
			type: "GET",
			url: "/games/" + data.id + "/deck",
			dataType: "json"
		})
		.done(function (data) {
			updateStatus("#status", JSON.stringify(data, null, 2));
			$("#deckLabel").text(data.deck.length);
			$("#deck").empty().append(
				getCardSvg()
			);
		})
		.fail(function (jqXHR, textStatus, errorThrown) {
			updateStatus("#status", errorThrown);
		});
	}

	function updatePile(data) {
		$.ajax({
			type: "GET",
			url: "/games/" + data.id + "/pile",
			dataType: "json"
		})
		.done(function (data) {
			updateStatus("#status", JSON.stringify(data, null, 2));
			$("#pileLabel").text(data.pile.length);
			$("#pile").empty().append(
				getCardSvg(data.card)
			);
		})
		.fail(function (jqXHR, textStatus, errorThrown) {
			updateStatus("#status", errorThrown);
		});
	}

	function updateGame(data) {
		id = data.id;
		$("#gameLabel").text(data.id);
	}

	function updatePlayer(data) {
		pid = data.pid;
		$("#playerLabel").text(data.player);
	}

	function updatePassHandSelect(data) {
		$("#passHandSelect").empty();
		for (let i = 0; i < data.players.length; i++) {
			appendOption("#passHandSelect", i, data.players[i]);
		}
	}

	function updatePickSelect(data) {
		$("#pickSelect").empty();
		for (let i = 0; i < data.players.length; i++) {
			appendOption("#pickSelect", i, data.players[i]);
		}
	}

	function listGames() {
		$.ajax({
			type: "GET",
			url: "/games",
			dataType: "json"
		})
		.done(function (data) {
			updateStatus("#status", JSON.stringify(data, null, 2));
			updateSelectGame(data);
			toggleGameModal();
		})
		.fail(function (jqXHR, textStatus, errorThrown) {
			updateStatus("#status", errorThrown);
		});
	}

	function selectGame() {
		parseDataValue({
			id: "#selectGameSelect"
		}, function (error, data) {
			if (error) {
				return updateStatus("#status", error);
			}
			$.ajax({
				type: "GET",
				url: "/games/" + data.id,
				dataType: "json"
			})
			.done(function (data) {
				updateStatus("#status", JSON.stringify(data, null, 2));
				updateGame(data);
				updateSelectPlayer(data);
				updatePassHandSelect(data);
				updatePickSelect(data);
				updateDeck(data);
				updatePile(data);
				togglePlayerModal();
			})
			.fail(function (jqXHR, textStatus, errorThrown) {
				updateStatus("#status", errorThrown);
			});
		});
	}

	function selectPlayer() {
		parseDataValue({
			pid: "#selectPlayerSelect"
		}, function (error, data) {
			if (error) {
				return updateStatus("#status", error);
			}
			$.ajax({
				type: "GET",
				url: "/games/" + id + "/players/" + data.pid,
				dataType: "json"
			})
			.done(function (data) {
				updateStatus("#status", JSON.stringify(data, null, 2));
				removeOption("#passHandSelect", data.pid);
				removeOption("#pickSelect", data.pid);
				updatePlayer(data);
				updateHand(data);
				socket.send(JSON.stringify({
					id: id,
					pid: pid
				}));
			})
			.fail(function (jqXHR, textStatus, errorThrown) {
				updateStatus("#status", errorThrown);
			});
		});
	}

	function getHand() {
		$.ajax({
			type: "GET",
			url: "/games/" + id + "/players/" + pid,
			dataType: "json"
		})
		.done(function (data) {
			updateStatus("#status", JSON.stringify(data, null, 2));
			updateHand(data);
		})
		.fail(function (jqXHR, textStatus, errorThrown) {
			updateStatus("#status", errorThrown);
		});
	}

	function discardHand() {
        parseDataValue({
			cid: "#handModalCard svg"
        }, function (error, data) {
			if (error) {
				return updateStatus("#status", error);
			}
			$.ajax({
				type: "PUT",
				url: "/games/" + id + "/players/" + pid + "/cards/" + data.cid + "/discard",
				dataType: "json"
			})
			.done(function (data) {
				updateStatus("#status", JSON.stringify(data, null, 2));
				updateHand(data);
				updatePile(data);
			})
			.fail(function (jqXHR, textStatus, errorThrown) {
				updateStatus("#status", errorThrown);
			});
        });
	}

	function passHand() {
        parseDataValue({
			cid: "#handModalCard svg",
			tid: "#passHandSelect"
        }, function (error, data) {
			if (error) {
				return updateStatus("#status", error);
			}
			$.ajax({
				type: "PUT",
				url: "/games/" + id + "/players/" + pid + "/cards/" + data.cid + "/pass/" + data.tid,
				dataType: "json"
			})
			.done(function (data) {
				updateStatus("#status", JSON.stringify(data, null, 2));
				updateHand(data);
			})
			.fail(function (jqXHR, textStatus, errorThrown) {
				updateStatus("#status", errorThrown);
			});
        });
	}

	function pickHand() {
		parseDataValue({
			tid: "#pickSelect"
		}, function (error, data) {
			if (error) {
				return updateStatus("#status", error);
			}
			$.ajax({
				type: "PUT",
				url: "/games/" + id + "/players/" + pid + "/pick/" + data.tid,
				dataType: "json"
			})
			.done(function (data) {
				updateStatus("#status", JSON.stringify(data, null, 2));
				updateHand(data);
			})
			.fail(function (jqXHR, textStatus, errorThrown) {
				updateStatus("#status", errorThrown);
			});
		});
	}

    function drawDeck() {
		$.ajax({
			type: "PUT",
			url: "/games/" + id + "/players/" + pid + "/draw",
			dataType: "json"
		})
		.done(function (data) {
			updateStatus("#status", JSON.stringify(data, null, 2));
			updateHand(data);
			updateDeck(data);
		})
		.fail(function (jqXHR, textStatus, errorThrown) {
			updateStatus("#status", errorThrown);
		});
    }

    function discardDeck() {
		$.ajax({
			type: "PUT",
			url: "/games/" + id + "/deck/discard",
			dataType: "json"
		})
		.done(function (data) {
			updateStatus("#status", JSON.stringify(data, null, 2));
			updateDeck(data);
			updatePile(data);
		})
		.fail(function (jqXHR, textStatus, errorThrown) {
			updateStatus("#status", errorThrown);
		});
    }

    function recycleHand() {
		$.ajax({
			type: "PUT",
			url: "/games/" + id + "/players/" + pid + "/recycle",
			dataType: "json"
		})
		.done(function (data) {
			updateStatus("#status", JSON.stringify(data, null, 2));
			updateHand(data);
			updatePile(data);
		})
		.fail(function (jqXHR, textStatus, errorThrown) {
			updateStatus("#status", errorThrown);
		});
    }

    function recycleDeck() {
		$.ajax({
			type: "PUT",
			url: "/games/" + id + "/deck/recycle",
			dataType: "json"
		})
		.done(function (data) {
			updateStatus("#status", JSON.stringify(data, null, 2));
			updateDeck(data);
			updatePile(data);
		})
		.fail(function (jqXHR, textStatus, errorThrown) {
			updateStatus("#status", errorThrown);
		});
    }

    function shufflePile() {
		$.ajax({
			type: "PUT",
			url: "/games/" + id + "/pile/shuffle",
			dataType: "json"
		})
		.done(function (data) {
			updateStatus("#status", JSON.stringify(data, null, 2));
			updateDeck(data);
			updatePile(data);
		})
		.fail(function (jqXHR, textStatus, errorThrown) {
			updateStatus("#status", errorThrown);
		});
    }

	function toggleGameModal() {
		gameModal = gameModal ?? new bootstrap.Modal(document.getElementById("gameModal"), {
			backdrop: 'static',
			keyboard: false
		});
		gameModal.toggle();
	}

	function togglePlayerModal() {
		playerModal = playerModal ?? new bootstrap.Modal(document.getElementById("playerModal"), {
			backdrop: 'static',
			keyboard: false
		});
		playerModal.toggle();
	}

	function toggleHandModal() {
		handModal = handModal ?? new bootstrap.Modal(document.getElementById("handModal"));
		handModal.toggle();
	}

	function toggleDeckModal() {
		deckModal = deckModal ?? new bootstrap.Modal(document.getElementById("deckModal"));
		deckModal.toggle();
	}

	function togglePileModal() {
		pileModal = pileModal ?? new bootstrap.Modal(document.getElementById("pileModal"));
		pileModal.toggle();
	}

	$("#gameModal").on("click", "button", toggleGameModal);
	$("#selectGame").click(selectGame);

	$("#playerModal").on("click", "button", togglePlayerModal);
	$("#selectPlayer").click(selectPlayer);

	$("#handModal").on("click", "button", toggleHandModal);
	$("#discardHand").click(discardHand);
	$("#passHand").click(passHand);

	$("#deckModal").on("click", "button", toggleDeckModal);
	$("#drawDeck").click(drawDeck);
	$("#discardDeck").click(discardDeck);

	$("#pileModal").on("click", "button", togglePileModal);
	$("#recycleHand").click(recycleHand);
	$("#recycleDeck").click(recycleDeck);
	$("#shufflePile").click(shufflePile);

	$("#hand").on("click", "svg", function () {
		$("#handModalCard").empty().append($(this).clone());
		toggleHandModal();
	});
	$("#deck").on("click", "svg", function () {
		toggleDeckModal();
	});
	$("#pile").on("click", "svg", function () {
		$("#pileModalCard").empty().append($(this).clone());
		togglePileModal();
	});
	$("#pick").click(pickHand);

	listGames();
});
