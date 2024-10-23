/**
Copyright (c) 2022-2024 Hidenori ISHIKAWA. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import debug from 'debug';


class Logger {
	constructor(name) {
		Object.defineProperties(this, {
			name: { value: name },
			loggers: { value: new Map() }
		});
	}

	log(level, ...args) {
		if (0 === args.length) {
			args.push(level);
			level = '';
		}
		const namespace = level ? `${this.name}:${level}`: this.name;
		if (false === this.loggers.has(namespace)) {
			this.loggers.set(namespace, debug(namespace));
		}
		this.loggers.get(namespace)(...args);
	}

	debug(...args) {
		this.log('debug', ...args);
	}

	info(...args) {
		this.log('info', ...args);
	}

	warn(...args) {
		this.log('warn', ...args);
	}

	error(...args) {
		this.log('error', ...args);
	}
}


const loggers = new Map();
const NOTSET = 0;
const DEBUG = 10;
const INFO = 20;
const WARN = 30;
const ERROR = 40;
const loggingLevels = [
	[NOTSET, '*'],
	[DEBUG, 'debug'],
	[INFO, 'info'],
	[WARN, 'warn'],
	[ERROR, 'error']
];
let loggingLevel = NOTSET;

function getLogger(name) {
	if (false === loggers.has(name)) {
		loggers.set(name, new Logger(name));
		setLevel(loggingLevel);
	}
	return loggers.get(name);
}

function setLevel(level) {
	const namespaces = [];
	if (loggingLevels.some(([key, _]) => key === level)) {
		[ ...loggers.keys() ].forEach((name) => {
			loggingLevels.forEach(([key, value]) => {
				if (level <= key) {
					namespaces.push(`${name}:${value}`);
				}
			});
		});
	}
	debug.enable(namespaces.join(','));
	loggingLevel = level;
}

export default { NOTSET, DEBUG, INFO, WARN, ERROR, getLogger, setLevel };
