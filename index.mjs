/**
Copyright (c) 2022-2024 Hidenori ISHIKAWA. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import EventEmitter from 'node:events';
import { readFile } from 'node:fs/promises';
import process from 'node:process';

import 'dotenv/config';

import { parseArgs } from './args.mjs';
import { createApp } from './app.mjs';
import { getLogger } from './logger.mjs';
import { name } from './pkgjson.mjs';
import { createServer } from './server.mjs';

const logger = getLogger(name);
const options = await parseArgs();
const emitter = new EventEmitter();
const app = createApp(emitter);
const server = createServer(emitter, await createServerOpts(options));

async function createServerOpts(options) {
	const serverOpts = {};
	if (options.key && options.cert) {
		logger.log(`Using key ${options.key}`);
		serverOpts.key = await readFile(options.key);
		logger.log(`Using cert ${options.cert}`);
		serverOpts.cert = await readFile(options.cert);
	}
	return serverOpts;
}

function shutdown() {
	emitter.emit('close');
	setTimeout(function () {
		logger.log(`Timeout exceeded for ${options.timeout} ms, shutdown`);
		process.exit(1);
	}, options.timeout);
	server.on('close', function () {
		logger.log('Shutdown');
		process.exit(0);
	});
}

logger.log('options', options);

process.on('SIGINT', function () {
	logger.log('SIGINT received');
	shutdown();
});
process.on('SIGTERM', function () {
	logger.log('SIGTERM received');
	shutdown();
});

server.on('request', app);

server.listen(options.port, options.ip, function () {
	logger.log(`Listening on ${options.ip}:${options.port}`);
});
