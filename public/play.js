$(document).ready(function () {
	function parseCard(card, i) {
		const suits = { C: "club", D: "diamond", H: "heart", S: "spade" };
		const ranks = { A: "01", 0: "10", J: "11", Q: "12", K: "13", X: "joker" };
		const suit = "_" + suits[card.suit];
		const rank = "_" + (ranks[card.rank] ?? ("0" + card.rank));
		return {
			["data-cid"]: i,
			src: "/images/card" + (suit ? suit : "") + rank + ".png",
			class: "img-fluid"
		};
	}

	function updateSelectGame(data) {
		$("#selectGameSelect").empty();
		for (const game of data.games) {
			utils.appendOption("#selectGameSelect", game, game);
		}
	}

	function updateSelectPlayer(data) {
		$("#selectPlayerInput").attr("value", data.id);
		$("#selectPlayerSelect").empty();
		for (let i = 0; i < data.players.length; i++) {
			utils.appendOption("#selectPlayerSelect", i, `${i}: [${data.players[i]}]`);
		}
	}

	function updateHand(data) {
		$("#hand").empty();
		for (let i = 0; i < data.hand.cards.length; i++) {
			$("#hand").append(
				$("<div />", { class: "col" }).append(
					$("<img />", parseCard(data.hand.cards.at(i), i))
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
			utils.updateStatus("#status", JSON.stringify(data, null, 2));
			$("#deckLabel").text(data.deck.length);
			$("#deck").empty().append(
				$("<img />", {
					src: "/images/card_back.png",
					class: "img-fluid"
				})
			);
		})
		.fail(function (jqXHR, textStatus, errorThrown) {
			utils.updateStatus("#status", errorThrown);
		});
	}

	function updatePile(data) {
		$.ajax({
			type: "GET",
			url: "/games/" + data.id + "/pile",
			dataType: "json"
		})
		.done(function (data) {
			utils.updateStatus("#status", JSON.stringify(data, null, 2));
			$("#pileLabel").text(data.pile.length);
			$("#pile").empty().append(
				$("<img />", data.card ? parseCard(data.card) : {
					src: "/images/card_back.png",
					class: "img-fluid"
				})
			);
		})
		.fail(function (jqXHR, textStatus, errorThrown) {
			utils.updateStatus("#status", errorThrown);
		});
	}

	function listGames() {
		$.ajax({
			type: "GET",
			url: "/games",
			dataType: "json"
		})
		.done(function (data) {
			utils.updateStatus("#status", JSON.stringify(data, null, 2));
			updateSelectGame(data);
		})
		.fail(function (jqXHR, textStatus, errorThrown) {
			utils.updateStatus("#status", errorThrown);
		});
	}

	function selectGame() {
		const data = utils.parseValue({
			id: "#selectGameSelect"
		});
		if (undefined !== data) {
			$.ajax({
				type: "GET",
				url: "/games/" + data.id,
				dataType: "json"
			})
			.done(function (data) {
				utils.updateStatus("#status", JSON.stringify(data, null, 2));
				$("#game").attr("data-id", data.id).text(data.id);
				updateSelectPlayer(data);
				updateDeck(data);
				updatePile(data);
			})
			.fail(function (jqXHR, textStatus, errorThrown) {
				utils.updateStatus("#status", errorThrown);
			});
		}
	}

	function selectPlayer() {
		const data = utils.parseValue({
			id: "#selectPlayerInput",
			pid: "#selectPlayerSelect"
		});
		if (undefined !== data) {
			$.ajax({
				type: "GET",
				url: "/games/" + data.id + "/players/" + data.pid,
				dataType: "json"
			})
			.done(function (data) {
				utils.updateStatus("#status", JSON.stringify(data, null, 2));
				$("#player").attr("data-pid", data.pid).text(`${data.pid} [${data.player}]`);
				updateHand(data);
			})
			.fail(function (jqXHR, textStatus, errorThrown) {
				utils.updateStatus("#status", errorThrown);
			});
		}
	}

	function discardHand() {
        const data = utils.parseData({
            id: "#game",
            pid: "#player",
			cid: "#handModalCard img"
        });
        if (undefined !== data) {
			$.ajax({
				type: "PUT",
				url: "/games/" + data.id + "/players/" + data.pid + "/cards/" + data.cid + "/discard",
				dataType: "json"
			})
			.done(function (data) {
				utils.updateStatus("#status", JSON.stringify(data, null, 2));
				updateHand(data);
				updatePile(data);
			})
			.fail(function (jqXHR, textStatus, errorThrown) {
				utils.updateStatus("#status", errorThrown);
			});
        }
	}

    function drawDeck() {
        const data = utils.parseData({
            id: "#game",
            pid: "#player"
        });
        if (undefined !== data) {
			$.ajax({
				type: "PUT",
				url: "/games/" + data.id + "/players/" + data.pid + "/draw",
				dataType: "json"
			})
			.done(function (data) {
				utils.updateStatus("#status", JSON.stringify(data, null, 2));
				updateHand(data);
				updateDeck(data);
			})
			.fail(function (jqXHR, textStatus, errorThrown) {
				utils.updateStatus("#status", errorThrown);
			});
        }
    }

    function recycleHand() {
        const data = utils.parseData({
            id: "#game",
            pid: "#player"
        });
        if (undefined !== data) {
			$.ajax({
				type: "PUT",
				url: "/games/" + data.id + "/players/" + data.pid + "/recycle",
				dataType: "json"
			})
			.done(function (data) {
				utils.updateStatus("#status", JSON.stringify(data, null, 2));
				updateHand(data);
				updatePile(data);
			})
			.fail(function (jqXHR, textStatus, errorThrown) {
				utils.updateStatus("#status", errorThrown);
			});
        }
    }

    function recycleDeck() {
        const data = utils.parseData({
            id: "#game"
        });
        if (undefined !== data) {
			$.ajax({
				type: "PUT",
				url: "/games/" + data.id + "/deck/recycle",
				dataType: "json"
			})
			.done(function (data) {
				utils.updateStatus("#status", JSON.stringify(data, null, 2));
				updateDeck(data);
				updatePile(data);
			})
			.fail(function (jqXHR, textStatus, errorThrown) {
				utils.updateStatus("#status", errorThrown);
			});
        }
    }

	function handModal() {
		const modal = document.getElementById('handModal');
		bootstrap.Modal.getOrCreateInstance(modal).toggle();
	}

	function drawModal() {
		const modal = document.getElementById('drawModal');
		bootstrap.Modal.getOrCreateInstance(modal).toggle();
	}

	function pileModal() {
		const modal = document.getElementById('pileModal');
		bootstrap.Modal.getOrCreateInstance(modal).toggle();
	}

	$("#listGames").click(listGames);
	$("#selectGame").click(selectGame);
	$("#selectPlayer").click(selectPlayer);

	$("#hand").on("click", "img", function() {
		$("#handModalCard").empty().append($(this).clone());
		handModal();
	});
	$("#handModal").on("click", "button", handModal);
	$("#discardHand").click(discardHand);

	$("#deck").on("click", "img", drawModal);
	$("#drawModal").on("click", "button", drawModal);
	$("#drawDeck").click(drawDeck);

	$("#pile").on("click", "img", function() {
		$("#pileModalCard").empty().append($(this).clone());
		pileModal()
	});
	$("#pileModal").on("click", "button", pileModal);
	$("#recycleHand").click(recycleHand);
	$("#recycleDeck").click(recycleDeck);
});
