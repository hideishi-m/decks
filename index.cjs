'use strict';

const debug = require('debug');
const EventEmitter = require('events');

const { newApp } = require('./app.cjs');
const { newServer } = require('./server.cjs');

const packageJson = require('./package.json');
const name = packageJson.name;
const config = packageJson.config;

debug.enable(`${name}:*`);

const emitter = new EventEmitter();
newApp(emitter, config.appPort, name);
newServer(emitter, config.serverPort, name);
