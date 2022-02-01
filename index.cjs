'use strict';

const debug = require('debug');
const EventEmitter = require('events');
const process = require('process');

const { newApp } = require('./app.cjs');
const { newServer } = require('./server.cjs');

const packageJson = require('./package.json');
const name = packageJson.name;
const port = packageJson.config.port;
const timeout = packageJson.config.timeout;

debug.enable(`${name}*`);

const logger = debug(name);
const emitter = new EventEmitter();
const app = newApp(emitter, name);
const server = newServer(emitter, name);

function shutdown() {
	emitter.emit('close');
	setTimeout(() => {
		logger(`Timeout exceeded for ${timeout} ms, shutdown`);
		process.exit(1);
	}, timeout);
	server.on('close', function () {
		logger('Shutdown');
		process.exit(0);
	});
}

process.on('SIGINT', function () {
	logger('SIGINT received');
	shutdown();
});
process.on('SIGTERM', function () {
	logger('SIGTERM received');
	shutdown();
});

server.on('request', app);

server.listen(port, function () {
	logger(`Listening on port ${port}`);
});
