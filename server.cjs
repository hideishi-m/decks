'use strict';

const debug = require('debug');
const http = require('http');
const ws = require('ws');

function newServer(emitter, name) {
	name = name ? `${name}:server` : 'server';

	const logger = debug(name);
	const wsMap = new Map();
	const server = http.createServer();
	const wsServer = new ws.Server({ server: server });

	emitter.on('deck', function (data) {
		logger({ deck: data });
		const id = data.id;
		const re = new RegExp(`^${id}:\\d+$`);
		wsMap.forEach(function (value, key) {
			if (re.test(key)) {
				if (wsServer.clients.has(value)) {
					value.send(JSON.stringify({ deck: data }));
					logger(`CARD to ${key}`);
				} else {
					wsMap.delete(key);
					logger(`delete ${key}`);
				}
			}
		});
	});

	emitter.on('pile', function (data) {
		logger({ pile: data });
		const id = data.id;
		const re = new RegExp(`^${id}:\\d+$`);
		wsMap.forEach(function (value, key) {
			if (re.test(key)) {
				if (wsServer.clients.has(value)) {
					value.send(JSON.stringify({ pile: data }));
					logger(`CARD to ${key}`);
				} else {
					wsMap.delete(key);
					logger(`delete ${key}`);
				}
			}
		});
	});

	emitter.on('hand', function (data) {
		logger({ hand: data });
		const id = data.id;
		const tid = data.tid;
		const key = `${id}:${tid}`;
		const value = wsMap.get(key);
		if (undefined !== value) {
			if (wsServer.clients.has(value)) {
				value.send(JSON.stringify({ hand: data }));
				logger(`CARD to ${key}`);
			} else {
				wsMap.delete(key);
				logger(`delete ${key}`);
			}
		}
	});

	wsServer.on('connection', function (ws, req) {
		const ip = req.socket.remoteAddress;
		logger(`connected from ${ip}`);

		ws.on('message', function (data) {
			logger({ message: data });
			try {
				data = JSON.parse(data) ?? {};
				const id = /^\d+$/.test(data.id) ? data.id : undefined;
				const pid = /^\d+$/.test(data.pid) ? data.pid : undefined;
				if (undefined !== id && undefined !== pid) {
					wsMap.set(`${id}:${pid}`, ws);
					logger(`welcome player ${pid} for game ${id}`);
					logger({ websockets: [...wsMap.keys()] });
				}
			} catch (error) {
				logger(error);
			}
		});

		ws.on('close', function () {
			logger(`closed from ${ip}`);
		});
	});

	emitter.on('close', function () {
		wsServer.clients.forEach(ws => {
			ws.terminate();
		});
		wsServer.close();
		server.close();
	});

	return server;
}

module.exports = { newServer };
