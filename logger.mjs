/**
Copyright (c) 2022-2024 Hidenori ISHIKAWA. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import debug from 'debug';

const loggers = new Map();

function getName(name) {
	try {
		const __filename = fileURLToPath(name);
		const __dirname = path.dirname(name);
		const dir = path.parse(__dirname).base;
		const file = path.parse(__filename).name;
		return 'index' === file ? dir : `${dir}:${file}`;
	} catch {
		return name;
	}
}

export function getLogger(name) {

	function logger(level, ...args) {
		if (0 === args.length) {
			args.push(level);
			level = '';
		}
		const namespace = level ? `${name}:${level}`: name;
		let logger = loggers.get(namespace);
		if (undefined === logger) {
			logger = debug(namespace);
			logger.color = loggers.size + 1;
			loggers.set(namespace, logger);
		}
		logger(...args);
	}

	Object.defineProperties(logger, {
		log: { value: function (level, ...args) {
			this(level, ...args);
		} },
		error: { value:  function (...args) {
			this('error', ...args);
		} }
	});

	name = getName(name);
	return logger;
}
