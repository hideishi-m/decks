function status(text) {
	$("#status").empty().append($("<pre />").text(text));
}

function parse(settings) {
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

function parseEach(settings) {
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
