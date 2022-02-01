$(document).ready(function () {
	function updateDeleteGame(data) {
		$("#deleteGameSelect").empty();
		for (const game of data.games) {
			utils.appendOption("#deleteGameSelect", game, game);
		}
	}

	function appendDeleteGame(id) {
		utils.appendOption("#deleteGameSelect", id, id);
	}

	function removeDeleteGame(id) {
		utils.removeOption("#deleteGameSelect", id);
	}

	function updateGames(data) {
		$("#game").empty();
		for (const game of data.games) {
			getGame({ id: game });
		}
	}

	function appendGame(data) {
		$("#game").append($("<div />", {
			class: "col-3",
			["data-id"]: data.id
		}).text(data.id));
		$("#game").append($("<div />", {
			class: "col-9",
			["data-id"]: data.id
		}).text(data.players));
	}

	function removeGame(data) {
		$(`#game div[data-id="${data.id}"]`).each(function () {
			$(this).remove();
		});
	}

	function getGame(data) {
		$.ajax({
			type: "GET",
			url: "/games/" + data.id,
			dataType: "json"
		})
		.done(function (data) {
			utils.updateStatus("#status", JSON.stringify(data, null, 2));
			appendGame(data);
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
			updateGames(data);
			updateDeleteGame(data);
		})
		.fail(function (jqXHR, textStatus, errorThrown) {
			utils.updateStatus("#status", errorThrown);
		});
	}

    function newGame() {
		utils.parseDataValuesEach({
			players: "input[name^=players]"
		}, function (error, data) {
			if (error) {
				return utils.updateStatus("#status", error);
			}
			$.ajax({
				type: "POST",
				url: "/games",
				data: JSON.stringify({
					players: data.players
				}),
				contentType: "application/json",
				dataType: "json"
			})
			.done(function (data) {
				utils.updateStatus("#status", JSON.stringify(data, null, 2));
				getGame(data);
				appendDeleteGame(data.id);
			})
			.fail(function (jqXHR, textStatus, errorThrown) {
				utils.updateStatus("#status", errorThrown);
			});
		});
    }

    function deleteGame() {
        utils.parseDataValue({
            id: "#deleteGameSelect"
        }, function (error, data) {
			if (error) {
				return utils.updateStatus("#status", error);
			}
            $.ajax({
                type: "DELETE",
                url: "/games/" + data.id,
                dataType: "json"
            })
			.done(function (data) {
				utils.updateStatus("#status", JSON.stringify(data, null, 2));
				removeGame(data);
				removeDeleteGame(data.id);
			})
			.fail(function (jqXHR, textStatus, errorThrown) {
				utils.updateStatus("#status", errorThrown);
			});
        });
    }

    $("#newGame").click(newGame);
    $("#deleteGame").click(deleteGame);

	$(".add").click(function () {
		const html = $(".copy").html();
		$("#players").parent().append(html);
	});
	$("#players").parent().on("click", ".remove", function () {
		$(this).parents(".input-group").remove();
	});

	listGames();
});
