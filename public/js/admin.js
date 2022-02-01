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

    function listGames() {
		$.ajax({
			type: "GET",
			url: "/games",
			dataType: "json"
		})
		.done(function (data) {
			utils.updateStatus("#status", JSON.stringify(data, null, 2));
			updateDeleteGame(data);
		})
		.fail(function (jqXHR, textStatus, errorThrown) {
			utils.updateStatus("#status", errorThrown);
		});
	}

    function newGame() {
		utils.parseValuesEach({
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
				utils.updateStatus("#status", "new game id = " + data.id);
				appendDeleteGame(data.id);
			})
			.fail(function (jqXHR, textStatus, errorThrown) {
				utils.updateStatus("#status", errorThrown);
			});
		});
    }

    function deleteGame() {
        utils.parseValue({
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
				utils.updateStatus("#status", "deleted game id = " + data.id);
				removeDeleteGame(data.id);
			})
			.fail(function (jqXHR, textStatus, errorThrown) {
				utils.updateStatus("#status", errorThrown);
			});
        });
    }

    $("#listGames").click(listGames);
    $("#newGame").click(newGame);
    $("#deleteGame").click(deleteGame);

	$(".add").click(function () {
		const html = $(".copy").html();
		$("#players").parent().append(html);
	});

	$("#players").parent().on("click", ".remove", function () {
		$(this).parents(".input-group").remove();
	});
});
