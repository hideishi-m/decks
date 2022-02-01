const utils = (function () {
	function updateStatus(selector, text) {
		$(selector).empty().append($("<pre />").text(text));
	}

	function parseValue(settings, callback) {
		const data = {};
		for (const [key, selector] of Object.entries(settings)) {
			data[key] = $(selector).val();
			if (false === /^\d+$/.test(data[key])) {
				return callback(key + " is empty");
			}
		}
		return callback(null, data);
	}

	function parseData(settings, callback) {
		const data = {};
		for (const [key, selector] of Object.entries(settings)) {
			data[key] = $(selector).data(key);
			if (false === /^\d+$/.test(data[key])) {
				return callback(key + " is empty");
			}
		}
		return callback(null, data);
	}

	function parseDataValue(settings, callback) {
		const data = {};
		for (const [key, selector] of Object.entries(settings)) {
			data[key] = undefined !== $(selector).data(key) ? $(selector).data(key) : $(selector).val();
			if (false === /^\d+$/.test(data[key])) {
				return callback(key + " is empty");
			}
		}
		return callback(null, data);
	}

	function parseValuesEach(settings, callback) {
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
				return callback(key + " is empty");
			}
		}
		return callback(null, data);
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
		parseDataValue: parseDataValue,
		parseValuesEach: parseValuesEach,
		appendOption: appendOption,
		removeOption: removeOption
	}
})();
