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

	// 卓に入れた接続には gid / pid / who が付く。付いていないものは配信対象外。
	// ⚠ 接続を identity で束ねない。同じ席を 2 つ開いても両方に届くようにするため。
	function sendToWebSockets(data, type) {
		const gid = data.gid;
		if (undefined === gid) {
			return;
		}
		wsServer.clients.forEach((ws) => {
			if (gid === ws.gid && ws.OPEN === ws.readyState) {
				ws.send(JSON.stringify({ [type]: data }));
				logger.log(`${type.toUpperCase()} to ${ws.who}`);
			}
		});
	}

	function connected() {
		return [ ...wsServer.clients ]
			.filter((ws) => undefined !== ws.gid)
			.map((ws) => ws.who);
	}

	const logger = getLogger(`${pkgJson.name}:server`);
	const app = createApp(emitter, options);
	const server = (options.key && options.cert) ? https.createServer({
		key: options.key,
		cert: options.cert,
	}, app) : http.createServer(app);
	const wsServer = new WebSocketServer({ server: server });

	emitter.on('action', (data) => {
		logger('emitter', { action: data });
		sendToWebSockets(data, 'action');
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
				ws.gid = gid;
				ws.pid = pid;
				ws.who = JSON.stringify({
					gid: gid,
					pid: pid,
					ip: ip,
				});
				logger.log(`set ${ws.who}`);
				logger.log(connected());
			});
		});

		ws.on('close', () => {
			// clients からは ws 自身が外れるので、こちらで消すものは無い。
			logger('ws', `closed from ${ip}`);
			logger.log(connected());
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
