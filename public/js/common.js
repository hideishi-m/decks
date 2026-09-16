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

// 卓は ticket が決めるので、クライアントは gid を送らない。
export async function join(ticket) {
	const data = await ajax('./join', {
		method: 'GET',
		headers: { 'Authorization': `Ticket ${ticket}` },
		cache: 'no-cache',
	});
	updateStatus(JSON.stringify(data, null, 2));
	return data;
}

export async function getToken(pid, ticket) {
	const data = await ajax('./token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Ticket ${ticket}`,
		},
		cache: 'no-cache',
		body: JSON.stringify({
			pid: `${pid}`,
		}),
	});
	updateStatus(JSON.stringify(data, null, 2));
	return data.token;
}

// ---- DOM ----

export function qs(selector, root) {
	return (root ?? document).querySelector(selector);
}

export function qsa(selector, root) {
	return [ ...(root ?? document).querySelectorAll(selector) ];
}

export function el(tag, attributes, ...children) {
	const node = document.createElement(tag);
	for (const [key, value] of Object.entries(attributes ?? {})) {
		if (undefined !== value && null !== value) {
			node.setAttribute(key, value);
		}
	}
	node.append(...children.filter((child) => undefined !== child && null !== child));
	return node;
}

// SVG も含めて HTML パーサに任せる。createElementNS を手で組むより読みやすい。
export function fromHtml(markup) {
	const template = document.createElement('template');
	template.innerHTML = markup.trim();
	return template.content.firstElementChild;
}

// jQuery の $(root).on(type, selector, handler) 相当。
// handler の this は selector にマッチした要素。
export function delegate(root, selector, type, handler) {
	root.addEventListener(type, (event) => {
		const target = event.target.closest(selector);
		if (target && root.contains(target)) {
			handler.call(target, event);
		}
	});
}

// bootstrap.Modal 相当。persistent は backdrop:'static' + keyboard:false のつもり。
export function createDialog(id, options) {
	const node = qs(`#${id}`);
	if (options?.persistent) {
		node.addEventListener('cancel', (event) => event.preventDefault());
	}
	return {
		node: node,
		open() {
			if (false === node.open) {
				node.showModal();
			}
		},
		close() {
			if (node.open) {
				node.close();
			}
		},
		toggle() {
			if (node.open) {
				node.close();
			} else {
				node.showModal();
			}
		},
	};
}

// ---- 画面のヘルパ ----

export function updateStatus(text) {
	qs('#status').replaceChildren(el('pre', null, text));
}

export function appendLog(data) {
	const log = qs('#log');
	log.textContent = data + '\n' + log.textContent;
}

// ⚠ マッチした全ての select に効く。admin.js が select[name^=tarots] に対して
// この前提で呼ぶので、querySelector（単数）に変えてはいけない。
export function appendOption(selector, id, text) {
	for (const select of qsa(selector)) {
		select.append(el('option', { value: id }, text));
	}
}

export function updateOptions(selector, array) {
	for (const select of qsa(selector)) {
		select.replaceChildren();
	}
	for (let i = 0; i < array.length; i++) {
		appendOption(selector, i, array[i]);
	}
}

export function removeOption(selector, id) {
	for (const option of qsa(`${selector} option[value='${id}']`)) {
		option.remove();
	}
}

// data-<key> があればそれを、無ければ value を読む。
// 対象が無い／数字でないときは throw して呼び出し側の catch に載せる。
export function parseDataValue(settings) {
	const data = {};
	for (const [key, selector] of Object.entries(settings)) {
		const node = qs(selector);
		data[key] = undefined !== node?.dataset[key] ? node.dataset[key] : node?.value;
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
		for (const node of qsa(selector)) {
			const value = undefined !== node.dataset[key] ? node.dataset[key] : node.value;
			if (value) {
				data[key].push(value);
			}
		}
		if (0 === data[key].length) {
			throw new Error(key + ' is empty');
		}
	}
	return data;
}
