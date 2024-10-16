/**
Copyright (c) 2022-2024 Hidenori ISHIKAWA. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import http from 'node:http';
import https from 'node:https';

import debug from 'debug';
import proxyaddr from 'proxy-addr';
import { WebSocketServer } from 'ws';

import { ping } from './public/js/common.js';

export function createServer(emitter, name, options) {
	name = name ? `${name}:server` : 'server';

	const logger = debug(name);
	const wsMap = new Map();

	const server = (options.key && options.cert) ? https.createServer(options) : http.createServer(options);
	const wsServer = new WebSocketServer({ server: server });

	emitter.on('deck', function (data) {
		logger.extend('emitter')({ deck: data });
		const id = data.id;
		const re = new RegExp(`^${id}:\\d+$`);
		wsMap.forEach((value, key) => {
			if (re.test(key)) {
				if (wsServer.clients.has(value)) {
					value.send(JSON.stringify({ deck: data }));
					logger(`DECK to ${key}`);
				} else {
					wsMap.delete(key);
					logger(`delete ${key}`);
				}
			}
		});
	});

	emitter.on('pile', function (data) {
		logger.extend('emitter')({ pile: data });
		const id = data.id;
		const re = new RegExp(`^${id}:\\d+$`);
		wsMap.forEach((value, key) => {
			if (re.test(key)) {
				if (wsServer.clients.has(value)) {
					value.send(JSON.stringify({ pile: data }));
					logger(`PILE to ${key}`);
				} else {
					wsMap.delete(key);
					logger(`delete ${key}`);
				}
			}
		});
	});

	emitter.on('hand', function (data) {
		logger.extend('emitter')({ hand: data });
		const id = data.id;
		const tid = data.tid;
		const key = `${id}:${tid}`;
		const value = wsMap.get(key);
		if (undefined !== value) {
			if (wsServer.clients.has(value)) {
				value.send(JSON.stringify({ hand: data }));
				logger(`HAND to ${key}`);
			} else {
				wsMap.delete(key);
				logger(`delete ${key}`);
			}
		}
	});

	emitter.on('tarot', function (data) {
		logger.extend('emitter')({ tarot: data });
		const id = data.id;
		const re = new RegExp(`^${id}:\\d+$`);
		wsMap.forEach((value, key) => {
			if (re.test(key)) {
				if (wsServer.clients.has(value)) {
					value.send(JSON.stringify({ tarot: data }));
					logger(`TAROT to ${key}`);
				} else {
					wsMap.delete(key);
					logger(`delete ${key}`);
				}
			}
		});
	});

	wsServer.on('connection', function (ws, req) {
		const ip = proxyaddr(req, ['loopback', 'uniquelocal']);
		logger(`connected from ${ip}`);

		ws.on('message', function (data) {
			if (Buffer.from(ping).equals(data)) {
				return ws.send(ping);
			}
			try {
				data = JSON.parse(data) ?? {};
				logger.extend('ws')({ message: data });
				const id = /^\d+$/.test(data.id) ? data.id : undefined;
				const pid = /^\d+$/.test(data.pid) ? data.pid : undefined;
				if (undefined !== id && undefined !== pid) {
					wsMap.set(`${id}:${pid}`, ws);
					logger(`welcome player ${pid} for game ${id}`);
					logger.extend('ws')({ websockets: [...wsMap.keys()] });
				}
			} catch (error) {
				logger.extend('error')(error);
			}
		});

		ws.on('close', function () {
			logger(`closed from ${ip}`);
		});
	});

	emitter.on('close', function () {
		wsServer.clients.forEach((ws) => {
			ws.terminate();
		});
		wsServer.close();
		server.close();
	});

	return server;
}
