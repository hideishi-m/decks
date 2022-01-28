'use strict';

const debug = require('debug');
const ws = require('ws');

function newServer(emitter, port, name) {
	port = port ?? 60001;
	name = name ? `${name}:server` : 'server';

	const logger = debug(name);

	const wsockets = new Map();

	const server = new ws.WebSocketServer({ port: port }, function () {
		logger(`Listening on port ${port}`);
	});

	emitter.on('card', function (data) {
		logger({ card: data });
		const id = data.id;
		const re = new RegExp(`^${id}:\\d+$`);
		logger({ wsockets: [...wsockets.keys()] });
		wsockets.forEach(function (value, key) {
			if (re.test(key)) {
				if (server.clients.has(value)) {
					value.send(JSON.stringify(data));
				} else {
					wsockets.delete(key);
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
		const value = wsockets.get(key);
		if (undefined !== value) {
			if (server.clients.has(value)) {
				value.send(JSON.stringify(data));
			} else {
				wsockets.delete(key);
				logger(`delete ${key}`);
			}
		}
	});

	server.on('connection', function (ws, req) {
		const ip = req.socket.remoteAddress;
		logger(`connected from ${ip}`);

		ws.on('message', function (data) {
			data = JSON.parse(data) ?? {};
			logger({ message: data });
			const id = /^\d+$/.test(data.id) ? data.id : undefined;
			const pid = /^\d+$/.test(data.pid) ? data.pid : undefined;
			if (undefined !== id && undefined !== pid) {
				wsockets.set(`${id}:${pid}`, ws);
				logger(`welcome player ${pid} for game ${id}`);
				logger({ wsockets: [...wsockets.keys()] });
			}
		});

		ws.on('close', function () {
			logger(`closed from ${ip}`);
		});
	});

	return server;
}

module.exports = { newServer };
