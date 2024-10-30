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

import proxyaddr from 'proxy-addr';
import { WebSocketServer } from 'ws';

import { createApp } from './app.mjs';
import { getLogger } from './logger.mjs';
import { name } from './pkgjson.mjs';
import { ping } from './public/js/common.js';

export function createServer(emitter, options) {
	const logger = getLogger(`${name}:server`);
	const app = createApp(emitter, options);
	const server = (options.key && options.cert) ? https.createServer({
		key: options.key,
		cert: options.cert,
	}, app) : http.createServer(app);
	const wsServer = new WebSocketServer({ server: server });
	const wsMap = new Map();

	emitter.on('deck', (data) => {
		logger('emitter', { deck: data });
		const gid = data.gid;
		wsMap.forEach((value, key) => {
			if (undefined !== gid && key?.gid === gid) {
				if (wsServer.clients.has(value)) {
					value.send(JSON.stringify({ deck: data }));
					logger.log(`DECK to ${key.gid}:${key.pid}`);
				} else {
					wsMap.delete(key);
					logger.log(`delete ${key.gid}:${key.pid}`);
				}
			}
		});
	});

	emitter.on('pile', (data) => {
		logger('emitter', { pile: data });
		const gid = data.gid;
		wsMap.forEach((value, key) => {
			if (undefined !== gid && key?.gid === gid) {
				if (wsServer.clients.has(value)) {
					value.send(JSON.stringify({ pile: data }));
					logger.log(`PILE to ${key.gid}:${key.pid}`);
				} else {
					wsMap.delete(key);
					logger.log(`delete ${key.gid}:${key.pid}`);
				}
			}
		});
	});

	emitter.on('hand', (data) => {
		logger('emitter', { hand: data });
		const gid = data.gid;
		wsMap.forEach((value, key) => {
			if (undefined !== gid && key?.gid === gid) {
				if (wsServer.clients.has(value)) {
					value.send(JSON.stringify({ hand: data }));
					logger.log(`HAND to ${key.gid}:${key.pid}`);
				} else {
					wsMap.delete(key);
					logger.log(`delete ${key.gid}:${key.pid}`);
				}
			}
		});
	});

	emitter.on('tarot', (data) => {
		logger('emitter', { tarot: data });
		const gid = data.gid;
		wsMap.forEach((value, key) => {
			if (undefined !== gid && key?.gid === gid) {
				if (wsServer.clients.has(value)) {
					value.send(JSON.stringify({ tarot: data }));
					logger.log(`TAROT to ${key.gid}:${key.pid}`);
				} else {
					wsMap.delete(key);
					logger.log(`delete ${key.gid}:${key.pid}`);
				}
			}
		});
	});

	wsServer.on('connection', (ws, req) => {
		const ip = proxyaddr(req, ['loopback', 'uniquelocal']);
		logger('ws', `connected from ${ip}`);

		ws.on('message', (data) => {
			if (Buffer.from(ping).equals(data)) {
				return ws.send(ping);
			}
			data = JSON.parse(data) ?? {};
			logger('ws', { message: data });
			const gid = data.gid;
			const pid = data.gid;
			const token = data.token;
			emitter.emit('token', {
				gid: gid,
				pid: pid,
				token: token,
			}, (err) => {
				if (err) {
					logger('ws', err);
					return ws.terminate();
				}
				wsMap.set({
					gid: gid,
					pid: pid,
					ip: ip,
				}, ws);
				logger.log(`welcome player ${pid} for game ${gid} from ${ip}`);
				logger.log([ ...wsMap.keys() ]);
			});
		});

		ws.on('close', () => {
			logger('ws', `closed from ${ip}`);
			wsMap.forEach((value, key, map) => {
				if (ws === value) {
					map.delete(key);
					logger.log(`delete ${key.gid}:${key.pid}`);
				}
			});
			logger.log([ ...wsMap.keys() ]);
		});

		ws.on('error', (err) => {
			logger('ws:error', '%O', err);
		});
	});

	wsServer.on('error', (err) => {
		logger.error(err);
	});

	emitter.on('close', () => {
		logger('emitter', 'close');
		wsServer.clients.forEach((ws) => {
			ws.terminate();
		});
		wsServer.close();
		server.close();
	});

	return server;
}
