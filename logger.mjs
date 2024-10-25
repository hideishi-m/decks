/**
Copyright (c) 2022-2024 Hidenori ISHIKAWA. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import debug from 'debug';

debug.colors = debug.colors.filter((c) => 1 !== c);  // reserve RED for error.
debug.coerce = function (val) {  // disable Error coercing.
	return val;
}

export function getLogger(name) {
	const loggers = new Map();

	function createLogger(level) {
		const namespace = level ? `${name}:${level}` : name;
		return loggers.get(namespace) ?? (() => {
			const logger = debug(namespace);
			if (namespace.endsWith(':error')) {
				logger.color = 1;  // error is in RED.
			}
			loggers.set(namespace, logger);
			return logger
		})();
	}

	function getLogger(level, ...args) {
		if (0 === args.length) {
			args.push(level);
			level = undefined;
		} else if ('string' !== typeof level) {
			args.unshift(level);
			level = undefined;
		}
		createLogger(level)(...args);
	}

	getLogger.log = function (...args) {
		createLogger()(...args);
	};
	getLogger.error = function (...args) {
		createLogger('error')(...args);
	};
	getLogger.enabled = function() {
		return [ ...loggers.entries() ].map(([key, value]) => {
			return [key, value.enabled];
		});
	}

	return getLogger;
}
