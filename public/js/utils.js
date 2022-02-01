const utils = (function () {
	function updateStatus(selector, text) {
		$(selector).empty().append($("<pre />").text(text));
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

	function parseDataValuesEach(settings, callback) {
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
		parseDataValue: parseDataValue,
		parseDataValuesEach: parseDataValuesEach,
		appendOption: appendOption,
		removeOption: removeOption
	}
})();
