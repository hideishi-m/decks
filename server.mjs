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
import { ping } from './public/js/common.js';

import pkgJson from './package.json' with { type: 'json' };

export function createServer(emitter, options) {

	function sendToWebSockets(data, type) {
		const gid = data.gid;
		wsMap.forEach((value, key) => {
			if (undefined !== gid && JSON.parse(key)?.gid === gid) {
				if (wsServer.clients.has(value)) {
					value.send(JSON.stringify({ [type]: data }));
					logger.log(`${type.toUpperCase()} to ${key}`);
				} else {
					wsMap.delete(key);
					logger.log(`delete ${key}`);
				}
			}
		});
	}

	const logger = getLogger(`${pkgJson.name}:server`);
	const app = createApp(emitter, options);
	const server = (options.key && options.cert) ? https.createServer({
		key: options.key,
		cert: options.cert,
	}, app) : http.createServer(app);
	const wsServer = new WebSocketServer({ server: server });
	const wsMap = new Map();

	emitter.on('deck', (data) => {
		logger('emitter', { deck: data });
		sendToWebSockets(data, 'deck');
	});

	emitter.on('pile', (data) => {
		logger('emitter', { pile: data });
		sendToWebSockets(data, 'pile');
	});

	emitter.on('hand', (data) => {
		logger('emitter', { hand: data });
		sendToWebSockets(data, 'hand');
	});

	emitter.on('tarot', (data) => {
		logger('emitter', { tarot: data });
		sendToWebSockets(data, 'tarot');
	});

	emitter.on('close', () => {
		logger('emitter', 'close');
		wsServer.clients.forEach((ws) => {
			ws.terminate();
		});
		wsServer.close();
		server.close();
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
			const pid = data.pid;
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

				logger.log(`welcome player ${pid} for game ${gid} from ${ip}`);
				const key = JSON.stringify({
					gid: gid,
					pid: pid,
					ip: ip,
				});
				wsMap.set(key, ws);
				logger.log(`set ${key}`);
				logger.log([ ...wsMap.keys() ]);
			});
		});

		ws.on('close', () => {
			logger('ws', `closed from ${ip}`);
			wsMap.forEach((value, key, map) => {
				if (ws === value) {
					map.delete(key);
					logger.log(`delete ${key}`);
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

	return server;
}
