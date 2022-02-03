/**
Copyright (c) 2022 Hidenori ISHIKAWA. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import debug from 'debug';
import EventEmitter from 'events';
import { readFile } from 'fs/promises';
import process from 'process';

import { newApp } from './app.mjs';
import { newServer } from './server.mjs';

const packageJson = JSON.parse(await readFile(new URL('./package.json', import.meta.url)));
const name = packageJson.name;
const port = packageJson.config.port;
const timeout = packageJson.config.timeout;

debug.enable(`${name}*`);

const logger = debug(name);
const emitter = new EventEmitter();
const app = newApp(emitter, name);

async function newOptions() {
	const options = {};
	const argv = process.argv.slice(2);
	if (argv[0] && argv[1]) {
		logger(`Using key ${argv[0]}`);
		options.key = await readFile(argv[0]);
		logger(`Using cert ${argv[1]}`);
		options.cert = await readFile(argv[1]);
	}
	return options;
}

const server = newServer(emitter, name, await newOptions());

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
