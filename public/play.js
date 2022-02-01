$(document).ready(function () {
	let id, pid;

	function getCardImgSrc(card) {
		const suits = { C: "club", D: "diamond", H: "heart", S: "spade" };
		const ranks = { A: "01", 0: "10", J: "11", Q: "12", K: "13", X: "joker" };
		const suit = "_" + suits[card.suit];
		const rank = "_" + (ranks[card.rank] ?? ("0" + card.rank));
		return "/images/card" + (suit ? suit : "") + rank + ".png";
	}

	function updateSelectGame(data) {
		$("#selectGameSelect").empty();
		for (const game of data.games) {
			utils.appendOption("#selectGameSelect", game, game);
		}
	}

	function updateSelectPlayer(data) {
		$("#selectPlayerSelect").empty();
		for (let i = 0; i < data.players.length; i++) {
			utils.appendOption("#selectPlayerSelect", i, data.players[i]);
		}
	}

	function updateHand(data) {
		$("#hand").empty();
		for (let i = 0; i < data.hand.cards.length; i++) {
			$("#hand").append(
				$("<div />", { class: "col" }).append(
					$("<img />", {
						class: "img-fluid",
						["data-cid"]: i,
						src: getCardImgSrc(data.hand.cards.at(i))
					})
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
				$("<img />", {
					class: "img-fluid",
					src: data.card ? getCardImgSrc(data.card) : "/images/card_back.png"
				})
			);
		})
		.fail(function (jqXHR, textStatus, errorThrown) {
			utils.updateStatus("#status", errorThrown);
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
			utils.appendOption("#passHandSelect", i, data.players[i]);
		}
	}

	function updatePickSelect(data) {
		$("#pickSelect").empty();
		for (let i = 0; i < data.players.length; i++) {
			utils.appendOption("#pickSelect", i, data.players[i]);
		}
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
			gameModal();
		})
		.fail(function (jqXHR, textStatus, errorThrown) {
			utils.updateStatus("#status", errorThrown);
		});
	}

	function selectGame() {
		utils.parseDataValue({
			id: "#selectGameSelect"
		}, function (error, data) {
			if (error) {
				return utils.updateStatus("#status", error);
			}
			$.ajax({
				type: "GET",
				url: "/games/" + data.id,
				dataType: "json"
			})
			.done(function (data) {
				utils.updateStatus("#status", JSON.stringify(data, null, 2));
				updateGame(data);
				updateSelectPlayer(data);
				updatePassHandSelect(data);
				updatePickSelect(data);
				updateDeck(data);
				updatePile(data);
				playerModal();
			})
			.fail(function (jqXHR, textStatus, errorThrown) {
				utils.updateStatus("#status", errorThrown);
			});
		});
	}

	function selectPlayer() {
		utils.parseDataValue({
			pid: "#selectPlayerSelect"
		}, function (error, data) {
			if (error) {
				return utils.updateStatus("#status", error);
			}
			$.ajax({
				type: "GET",
				url: "/games/" + id + "/players/" + data.pid,
				dataType: "json"
			})
			.done(function (data) {
				utils.updateStatus("#status", JSON.stringify(data, null, 2));
				utils.removeOption("#passHandSelect", data.pid);
				utils.removeOption("#pickSelect", data.pid);
				updatePlayer(data);
				updateHand(data);
			})
			.fail(function (jqXHR, textStatus, errorThrown) {
				utils.updateStatus("#status", errorThrown);
			});
		});
	}

	function discardHand() {
        utils.parseDataValue({
			cid: "#handModalCard img"
        }, function (error, data) {
			if (error) {
				return utils.updateStatus("#status", error);
			}
			$.ajax({
				type: "PUT",
				url: "/games/" + id + "/players/" + pid + "/cards/" + data.cid + "/discard",
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
        });
	}

	function passHand() {
        utils.parseDataValue({
			cid: "#handModalCard img",
			tid: "#passHandSelect"
        }, function (error, data) {
			if (error) {
				return utils.updateStatus("#status", error);
			}
			$.ajax({
				type: "PUT",
				url: "/games/" + id + "/players/" + pid + "/cards/" + data.cid + "/pass/" + data.tid,
				dataType: "json"
			})
			.done(function (data) {
				utils.updateStatus("#status", JSON.stringify(data, null, 2));
				updateHand(data);
			})
			.fail(function (jqXHR, textStatus, errorThrown) {
				utils.updateStatus("#status", errorThrown);
			});
        });
	}

	function pickHand() {
		utils.parseDataValue({
			tid: "#pickSelect"
		}, function (error, data) {
			if (error) {
				return utils.updateStatus("#status", error);
			}
			$.ajax({
				type: "PUT",
				url: "/games/" + id + "/players/" + pid + "/pick/" + data.tid,
				dataType: "json"
			})
			.done(function (data) {
				utils.updateStatus("#status", JSON.stringify(data, null, 2));
				updateHand(data);
			})
			.fail(function (jqXHR, textStatus, errorThrown) {
				utils.updateStatus("#status", errorThrown);
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
			utils.updateStatus("#status", JSON.stringify(data, null, 2));
			updateHand(data);
			updateDeck(data);
		})
		.fail(function (jqXHR, textStatus, errorThrown) {
			utils.updateStatus("#status", errorThrown);
		});
    }

    function recycleHand() {
		$.ajax({
			type: "PUT",
			url: "/games/" + id + "/players/" + pid + "/recycle",
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

    function recycleDeck() {
		$.ajax({
			type: "PUT",
			url: "/games/" + id + "/deck/recycle",
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

	function gameModal() {
		const modal = document.getElementById('gameModal');
		bootstrap.Modal.getOrCreateInstance(modal).toggle();
	}

	function playerModal() {
		const modal = document.getElementById('playerModal');
		bootstrap.Modal.getOrCreateInstance(modal).toggle();
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

	$("#gameModal").on("click", "button", gameModal);
	$("#selectGame").click(selectGame);

	$("#playerModal").on("click", "button", playerModal);
	$("#selectPlayer").click(selectPlayer);

	$("#handModal").on("click", "button", handModal);
	$("#discardHand").click(discardHand);
	$("#passHand").click(passHand);

	$("#drawModal").on("click", "button", drawModal);
	$("#drawDeck").click(drawDeck);

	$("#pileModal").on("click", "button", pileModal);
	$("#recycleHand").click(recycleHand);
	$("#recycleDeck").click(recycleDeck);

	$("#hand").on("click", "img", function () {
		$("#handModalCard").empty().append($(this).clone());
		handModal();
	});
	$("#deck").on("click", "img", drawModal);
	$("#pile").on("click", "img", function () {
		$("#pileModalCard").empty().append($(this).clone());
		pileModal()
	});
	$("#pick").click(pickHand);

	listGames();
});
