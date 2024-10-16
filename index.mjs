/**
Copyright (c) 2022 Hidenori ISHIKAWA. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import EventEmitter from 'node:events';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import debug from 'debug';

import { version, parseArgs } from './args.mjs';
import { newApp } from './app.mjs';
import { newServer } from './server.mjs';

const options = await parseArgs();
const name = options.name ?? 'decks';

debug.enable(`${name}*`);

const logger = debug(name);
const emitter = new EventEmitter();
const app = newApp(emitter, name, version);

async function newServerOpts(options) {
	const serverOpts = {};
	if (options.key && options.cert) {
		logger(`Using key ${options.key}`);
		serverOpts.key = await readFile(options.key);
		logger(`Using cert ${options.cert}`);
		serverOpts.cert = await readFile(options.cert);
	}
	return serverOpts;
}

const server = newServer(emitter, name, await newServerOpts(options));

function shutdown() {
	emitter.emit('close');
	setTimeout(() => {
		logger(`Timeout exceeded for ${options.timeout} ms, shutdown`);
		process.exit(1);
	}, options.timeout);
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

server.listen(options.port, options.ip, function () {
	logger(`Listening on ${options.ip}:${options.port}`);
});
