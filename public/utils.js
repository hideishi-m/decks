const utils = (function () {
	function updateStatus(selector, text) {
		$(selector).empty().append($("<pre />").text(text));
	}

	function parseValue(settings) {
		const data = {};
		for (const [key, selector] of Object.entries(settings)) {
			data[key] = $(selector).val();
			if (false === /^\d+$/.test(data[key])) {
				status(key + " is empty");
				return undefined;
			}
		}
		return data;
	}

	function parseData(settings) {
		const data = {};
		for (const [key, selector] of Object.entries(settings)) {
			data[key] = $(selector).data(key);
			if (false === /^\d+$/.test(data[key])) {
				status(key + " is empty");
				return undefined;
			}
		}
		return data;
	}

	function parseValueEach(settings) {
		const data = {};
		for (const [key, selector] of Object.entries(settings)) {
			data[key] = [];
			$(selector).each(function () {
				const value = $(this).val();
				if (value) {
					data[key].push(value);
				}
			});
			if (0 === data[key].length) {
				status(key + " is empty");
				return undefined;
			}
		}
		return data;
	}

	function appendOption(selector, value, text) {
		$(selector).append($("<option />", { value: value }).text(text));
	}

	function removeOption(selector, value) {
		$(`${selector} option[value="${value}"]`).remove();
	}

	return {
		updateStatus: updateStatus,
		parseValue: parseValue,
		parseData: parseData,
		parseValueEach: parseValueEach,
		appendOption: appendOption,
		removeOption: removeOption
	}
})();
