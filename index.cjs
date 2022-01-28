'use strict';

const debug = require('debug');
const EventEmitter = require('events');
const process = require('process');

const { newApp } = require('./app.cjs');
const { newServer } = require('./server.cjs');

const packageJson = require('./package.json');
const name = packageJson.name;
const port = packageJson.config.port;

debug.enable(`${name}*`);

const logger = debug(name);
const emitter = new EventEmitter();
const app = newApp(emitter, name);
const server = newServer(emitter, name);

server.on('request', app);

server.listen(port, function() {
	logger(`Listening on port ${port}`);
});
process.on('SIGINT', function() {
	logger('SIGINT received');
	server.close(function() {
		logger('Shutting down');
	});
});
