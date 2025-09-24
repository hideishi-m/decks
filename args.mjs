/**
Copyright (c) 2022-2024 Hidenori ISHIKAWA. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import process from 'node:process';

import pkgJson from './package.json' with { type: 'json' };

export function parseArgs() {

	function usage(message) {
		if (message) {
			console.error(message);
		}
		console.error(`usage: ${process.argv[1]}
    [--ip IP]               Listen at IP address (default: '127.0.0.1')
    [--port PORT]           Listen at PORT (default: 8080)
    [--key SSL_KEY]         Use SSL_KEY for ssl key
    [--cert SSL_CERT]       Use SSL_CERT for ssl certificate
    [--secret SECRET]       Set SECRET for JWT secret
`);
		process.exit(1);
	}

	function defaults() {
		const options = {};
		['ip', 'port', 'key', 'cert', 'secret'].forEach((key) => {
			if (undefined !== pkgJson.config[key]) {
				options[key] = pkgJson.config[key];
			}
		});
		if (undefined === options['secret']
			&& undefined !== process.env['SECRET']) {
			options['secret'] = process.env['SECRET'];
		}
		return options;
	}

	const options = defaults();
	const args = process.argv.slice(2);

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		let m;
		if ('-h' === arg || '--help' === arg) {
			usage();
		} else if (null !== (m = arg.match(/^--([^=]+)=(.*)$/s))) {
			options[m[1]] = m[2];
		} else if (null !== (m = arg.match(/^--no(.+)/))) {
			options[m[1]] = false;
		} else if (null !== (m = arg.match(/^--(.+)/))) {
			const next = args[i + 1];
			if (undefined !== next && false === /^--(.+)/.test(next)) {
				options[m[1]] = next;
				i++;
			} else {
				options[m[1]] = true;
			}
		} else {
			usage(`Unknown option: ${arg}`);
		}
	}

	return options;
}
