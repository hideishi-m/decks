/**
Copyright (c) 2022-2024 Hidenori ISHIKAWA. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

export const ping = '';
export const timeout = 10000;
export const retryWait = 5000;

export async function ajax(url, args) {
	const response = await fetch(url, args);
	if (false === response.ok) {
		throw new Error(`${response.status} ${response.statusText}`);
	}
	return await response.json();
}

export function updateStatus(text) {
	$('#status').empty().append($('<pre />').text(text));
}

export function appendLog(data) {
	const text = $('#log').text();
	$('#log').text(data + '\n' + text);
}

export function appendOption(selector, id, text) {
	$(selector).append($('<option />', {
		value: id,
	}).text(text));
}

export function updateOptions(selector, array) {
	$(selector).empty();
	for (let i = 0; i < array.length; i++) {
		appendOption(selector, i, array[i]);
	}
}

export function removeOption(selector, id) {
	$(`${selector} option[value='${id}']`).remove();
}

export function parseDataValue(settings) {
	const data = {};
	for (const [key, selector] of Object.entries(settings)) {
		data[key] = undefined !== $(selector).data(key) ? $(selector).data(key) : $(selector).val();
		if (false === /^\d+$/.test(data[key])) {
			throw new Error(key + ' is empty');
		}
	}
	return data;
}

export function parseDataValuesEach(settings) {
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
			throw new Error(key + ' is empty');
		}
	}
	return data;
}
