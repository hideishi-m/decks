'use strict';

const debug = require('debug');

const { newApp } = require('./app.cjs');

const packageJson = require('./package.json');
const name = packageJson.name;
const config = packageJson.config;

debug.enable(`${name}:*`);

newApp(config.appPort, name);
