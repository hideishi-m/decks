/**
Copyright (c) 2022-2024 Hidenori ISHIKAWA. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import { randomBytes } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { fileURLToPath } from 'node:url';

import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import jwt from 'jsonwebtoken';

import { createGame } from './game.mjs';
import { getLogger } from './logger.mjs';
import { name, version } from './pkgjson.mjs';


class AppError extends Error {
	constructor(code = 500, message, options) {
		super(message, options);
		this.code = code;
	}
}


export function createApp(emitter, options) {

	function validateId(req, res, next, value, key) {
		if (false === /^\d+$/.test(value)) {
			throw new AppError(400, `invalid format for ${key}`, { cause: { [key]: value } });
		}
		if (0 > parseInt(value)) {
			throw new AppError(400, `invalid value for ${key}`, { cause: { [key]: value } });
		}
		next();
	}

	function validateGame(req, res, next, value, key) {
		const game = games[value];
		if (undefined === game) {
			throw new AppError(404, `game not found for ${key}`, { cause: { [key]: value } });
		}
		next();
	}

	function validatePlayer(req, res, next, value, key) {
		const game = games[req.params.gid];
		const player = game.getPlayer(value);
		if (undefined === player) {
			throw new AppError(404, `player not found for ${key}`, { cause: {
				gid: req.params.gid,
				[key]: value,
			} });
		}
		next();
	}

	function validateCard(req, res, next, value, key) {
		const game = games[req.params.gid];
		const hand = game.getHandOfPlayer(req.params.pid);
		const card = hand.at(value);
		if (undefined === card) {
			throw new AppError(404, 'card not found for cid', { cause: {
				gid: req.params.gid,
				pid: req.params.pid,
				[key]: value,
			} });
		}
		next();
	}

	function validateArray(req, res, next, value, key) {
		if (false === Array.isArray(value)) {
			throw new AppError(400, `invalid value for ${key}`, { cause: { [key]: value } });
		}
		next();
	}

	function verifyToken(req, res, next) {
		if (undefined === req.decoded) {
			if (undefined === req.token()) {
				res.set('WWW-Authenticate', `Bearer realem="/games"`);
				throw new AppError(401, 'authorization required');
			}
			try {
				req.decoded = jwt.verify(req.token(), secret);
			} catch (error) {
				logger.error(error);
				res.set('WWW-Authenticate', `Bearer realem="/games", error="invalid_token", error_description="${error.message}"`);
				throw new AppError(401, 'authorization failed', { cause: `${error.name}: ${error.message}` });
			}
		}
		if (undefined !== req.params.gid) {
			if (req.params.gid !== req.decoded.gid) {
				res.set('WWW-Authenticate', `Bearer realem="id: ${req.params.gid}", error="insufficient_scope"`);
				throw new AppError(403, 'authorization failed for gid', { cause: { gid: req.params.gid } });
			}
		}
		if (undefined !== req.params.pid) {
			if (req.params.pid !== req.decoded.pid) {
				res.set('WWW-Authenticate', `Bearer realem="pid: ${req.params.pid}", error="insufficient_scope"`);
				throw new AppError(403, 'authorization failed for pid', { cause: { pid: req.params.pid } });
			}
		}
		next();
	}

	function partialReqKey(fn, keys) {
		return (req, res, next) => {
			const key = keys.at(-1);
			const value = keys.reduce((acc, cur) => {
				return acc?.[cur];
			}, req);
			return fn(req, res, next, value, key);
		};
	};

	function recurse(fns) {
		const fn = fns.shift();
		return (req, res, next) => {
			return fn(req, res, 0 === fns.length ? next : () => {
				recurse(fns)(req, res, next);
			});
		};
	}

	function getDateString() {
		// sv-SV is in YYYY-MM-DD format.
		return new Date().toLocaleDateString('sv-SV').replaceAll('-', '');
	}

	const logger = getLogger(`${name}:app`);
	const games = [];
	const app = express();
	const secret = options.secret ?? randomBytes(64).toString('hex');

	logger(`secret "${secret}"`);

	const stream = createWriteStream(fileURLToPath(new URL(`./logs/access.log-${getDateString()}`, import.meta.url)), { flags: 'a' });

	stream.on('error', (err) => {
		logger.error(err);
	});

	emitter.on('token', (data, next) => {
		try {
			const req = {
				params: {
					gid: data.gid,
					pid: data.pid,
				},
				token() { return data.token; },
			};
			const res = {
				set() {},
			};
			recurse([
				partialReqKey(validateId, ['params', 'gid']),
				partialReqKey(validateGame, ['params', 'gid']),
				partialReqKey(validateId, ['params', 'pid']),
				partialReqKey(validatePlayer, ['params', 'pid']),
				verifyToken,
			])(req, res, next);
		} catch (error) {
			if (error instanceof AppError) {
				next( { error: {
					message: error.message,
					cause: error.cause,
				} });
			} else {
				logger.error(error);
				next( { error: {
					message: `${error.name}: ${error.message}`,
				} });
			}
		}
	});

	app.request.token = function () {
		const authorization = this.get('authorization');
		if (undefined === authorization) {
			return undefined;
		}
		const [bearer, token] = authorization.split(' ') ?? [];
		if ('Bearer' !== bearer) {
			return undefined;
		}
		return token;
	};
	app.response.statusJson = function (code, body) {
		this.locals.route = this.req.route?.path;  // store to locals for logger.
		this.locals.body = body;  // store to locals for logger.
		return this
			.set('Cache-Control', 'no-cache')
			.status(code)
			.json(body);
	};

	app.set('trust proxy', 'loopback, uniquelocal');
	app.disable('x-powered-by');
	app.disable('etag');
	app.use(morgan('combined', {
			stream: stream,
	}));
	app.use(helmet());
	app.use(express.json({
		limit: '10mb',
	}));

	app.use((req, res, next) => {
		logger('request', {
			time: new Date(),
			ip: req.ip,
			method: req.method,
			path: req.path,
			token: req.token(),
			body: req.body,
		});
		res.on('finish', () => {
			logger('response', {
				time: new Date(),
				route: res.locals.route,  // retrive from locals stored in statusJson().
				status: res.statusCode,
				body: res.locals.body,  // retrive from locals stored in statusJson().
			});
		});
		next();
	});

	app.param('gid', validateId);
	app.param('gid', validateGame);

	app.param('pid', validateId);
	app.param('pid', validatePlayer);

	app.param('cid', validateId);
	app.param('cid', validateCard);

	app.param('tid', validateId);
	app.param('tid', validatePlayer);

	app.route('/version')
		.get((req, res, next) => {
			res.statusJson(200, {
				version: version,
			});
		});

	app.route('/token')
		.post(partialReqKey(validateId, ['body', 'gid']), partialReqKey(validateId, ['body', 'pid']), (req, res, next) => {
			const token = jwt.sign({
				gid: `${req.body.gid}`,
				pid: `${req.body.pid}`,
			}, secret, { expiresIn: '1d' });
			logger.log(`POST token for player ${req.body.pid} in game ${req.body.gid}`);
			res.statusJson(200, {
				token: token,
			});
		});

	app.route('/games')
		.get((req, res, next) => {
			const gids = [];
			games.forEach((game, index) => {
				if (undefined !== game) {
					gids.push({ gid: `${index}` });
				}
			});
			logger.log(`GET games ${gids.map((game) => game.gid)}`);
			res.statusJson(200, {
				games: gids,
			});
		})
		.post(partialReqKey(validateArray, ['body', 'players']), partialReqKey(validateArray, ['body', 'tarots']), (req, res, next) => {
			const gid = games.push(createGame(req.body.players, req.body.tarots)) - 1;
			logger.log(`POST game ${gid} for players ${req.body.players}`);
			res.statusJson(200, {
				gid: `${gid}`,
			});
		});

	app.route('/games/:gid')
		.get((req, res, next) => {
			const game = games[req.params.gid];
			const players = game.getAllPlayers();
			logger.log(`GET game ${req.params.gid} for players ${players}`);
			res.statusJson(200, {
				gid: req.params.gid,
				players: players,
			});
		})
		.delete(verifyToken, (req, res, next) => {
			delete games[req.params.gid];
			logger.log(`DELETE game ${req.params.gid}`);
			res.statusJson(200, {
				gid: req.params.gid,
			});
		});

	app.route('/games/:gid/deck')
		.get(verifyToken, (req, res, next) => {
			const game = games[req.params.gid];
			const deck = game.getDeck();
			logger.log(`GET deck in game ${req.params.gid}`);
			res.statusJson(200, {
				gid: req.params.gid,
				deck: deck.toJson(),
			});
		});

	app.route('/games/:gid/deck/discard')
		.put(verifyToken, (req, res, next) => {
			const game = games[req.params.gid];
			const deck = game.getDeck();
			const pile = game.getPile();
			deck.discard(0);
			logger.log(`DISCARD card 0 for deck in game ${req.params.gid}`);
			emitter.emit('deck', {
				gid: req.params.gid,
				pid: req.decoded.pid,
			});
			emitter.emit('pile', {
				gid: req.params.gid,
				pid: req.decoded.pid,
			});
			res.statusJson(200, {
				gid: req.params.gid,
				deck: deck.toJson(),
				pile: pile.toJson(),
			});
		});

	app.route('/games/:gid/deck/recycle')
		.put(verifyToken, (req, res, next) => {
			const game = games[req.params.gid];
			const deck = game.getDeck();
			const pile = game.getPile();
			deck.recycle();
			logger.log(`RECYCLE for deck in game ${req.params.gid}`);
			emitter.emit('deck', {
				gid: req.params.gid,
				pid: req.decoded.pid,
			});
			emitter.emit('pile', {
				gid: req.params.gid,
				pid: req.decoded.pid,
			});
			res.statusJson(200, {
				gid: req.params.gid,
				deck: deck.toJson(),
				pile: pile.toJson(),
			});
		});

	app.route('/games/:gid/pile')
		.get(verifyToken, (req, res, next) => {
			const game = games[req.params.gid];
			const pile = game.getPile();
			logger.log(`GET pile in game ${req.params.gid}`);
			res.statusJson(200, {
				gid: req.params.gid,
				pile: pile.toJson(),
			});
		});

	app.route('/games/:gid/pile/shuffle')
		.put(verifyToken, (req, res, next) => {
			const game = games[req.params.gid];
			const pile = game.getPile();
			const deck = game.getDeck();
			pile.shuffle();
			logger.log(`SHUFFLE pile in game ${req.params.gid}`);
			emitter.emit('deck', {
				gid: req.params.gid,
				pid: req.decoded.pid,
			});
			emitter.emit('pile', {
				gid: req.params.gid,
				pid: req.decoded.pid,
			});
			res.statusJson(200, {
				gid: req.params.gid,
				deck: deck.toJson(),
				pile: pile.toJson(),
			});
		});

	app.route('/games/:gid/players/:pid')
		.get(verifyToken, (req, res, next) => {
			const game = games[req.params.gid];
			const player = game.getPlayer(req.params.pid);
			const hand = game.getHandOfPlayer(req.params.pid);
			logger.log(`GET hand for player ${req.params.pid} ${player} in game ${req.params.gid}`);
			res.statusJson(200, {
				gid: req.params.gid,
				pid: req.params.pid,
				player: player,
				hand: hand.toJson(),
			});
		});

	app.route('/games/:gid/players/:pid/draw')
		.put(verifyToken, (req, res, next) => {
			const game = games[req.params.gid];
			const player = game.getPlayer(req.params.pid);
			const hand = game.getHandOfPlayer(req.params.pid);
			const deck = game.getDeck();
			hand.draw();
			logger.log(`DRAW for player ${req.params.pid} ${player} in game ${req.params.gid}`);
			emitter.emit('deck', {
				gid: req.params.gid,
				pid: req.params.pid,
				player: player,
			});
			res.statusJson(200, {
				gid: req.params.gid,
				pid: req.params.pid,
				player: player,
				deck: deck.toJson(),
				hand: hand.toJson(),
			});
		});

	app.route('/games/:gid/players/:pid/recycle')
		.put(verifyToken, (req, res, next) => {
			const game = games[req.params.gid];
			const player = game.getPlayer(req.params.pid);
			const hand = game.getHandOfPlayer(req.params.pid);
			const pile = game.getPile();
			hand.recycle();
			logger.log(`RECYCLE for player ${req.params.pid} ${player} in ${req.params.gid}`);
			emitter.emit('pile', {
				gid: req.params.gid,
				pid: req.params.pid,
				player: player,
			});
			res.statusJson(200, {
				gid: req.params.gid,
				pid: req.params.pid,
				player: player,
				pile: pile.toJson(),
				hand: hand.toJson(),
			});
		});

	app.route('/games/:gid/players/:pid/cards/:cid')
		.get(verifyToken, (req, res, next) => {
			const game = games[req.params.gid];
			const player = game.getPlayer(req.params.pid);
			const hand = game.getHandOfPlayer(req.params.pid);
			const card = hand.at(req.params.cid);
			logger.log(`GET card ${req.params.cid} for player ${req.params.pid} ${player} in game ${req.params.gid}`);
			res.statusJson(200, {
				gid: req.params.gid,
				pid: req.params.pid,
				player: player,
				cid: req.params.cid,
				card: card,
			});
		});

	app.route('/games/:gid/players/:pid/cards/:cid/discard')
		.put(verifyToken, (req, res, next) => {
			const game = games[req.params.gid];
			const player = game.getPlayer(req.params.pid);
			const hand = game.getHandOfPlayer(req.params.pid);
			const pile = game.getPile();
			hand.discard(req.params.cid);
			logger.log(`DISCARD card ${req.params.cid} for player ${req.params.pid} ${player} in game ${req.params.gid}`);
			emitter.emit('pile', {
				gid: req.params.gid,
				pid: req.params.pid,
				player: player,
			});
			res.statusJson(200, {
				gid: req.params.gid,
				pid: req.params.pid,
				player: player,
				pile: pile.toJson(),
				hand: hand.toJson(),
			});
		});

	app.route('/games/:gid/players/:pid/cards/:cid/pass/:tid')
		.put(verifyToken, (req, res, next) => {
			const game = games[req.params.gid];
			const player = game.getPlayer(req.params.pid);
			const hand = game.getHandOfPlayer(req.params.pid);
			const playerTo = game.getPlayer(req.params.tid);
			hand.passTo(req.params.cid, req.params.tid);
			logger.log(`PASS card ${req.params.cid} for player ${req.params.pid} ${player} to ${req.params.tid} ${playerTo} in game ${req.params.gid}`);
			emitter.emit('hand', {
				gid: req.params.gid,
				pid: req.params.pid,
				player: player,
				tid: req.params.tid,
				playerTo: playerTo,
			});
			res.statusJson(200, {
				gid: req.params.gid,
				pid: req.params.pid,
				player: player,
				hand: hand.toJson(),
			});
		});

	app.route('/games/:gid/players/:pid/pick/:tid')
		.put(verifyToken, (req, res, next) => {
			const game = games[req.params.gid];
			const player = game.getPlayer(req.params.pid);
			const hand = game.getHandOfPlayer(req.params.pid);
			const playerFrom = game.getPlayer(req.params.tid);
			hand.pickFrom(req.params.tid);
			logger.log(`PICK for player ${req.params.pid} ${player} from ${req.params.tid} ${playerFrom} in game ${req.params.gid}`);
			emitter.emit('hand', {
				gid: req.params.gid,
				pid: req.params.pid,
				player: player,
				tid: req.params.tid,
				playerFrom: playerFrom,
			});
			res.statusJson(200, {
				gid: req.params.gid,
				pid: req.params.pid,
				player: player,
				hand: hand.toJson(),
			});
		});

	app.route('/games/:gid/tarot/deck')
		.get(verifyToken, (req, res, next) => {
			const game = games[req.params.gid];
			const deck = game.getTarotDeck();
			logger.log(`GET tarot deck in game ${req.params.gid}`);
			res.statusJson(200, {
				gid: req.params.gid,
				deck: deck.toJson(),
			});
		});

	app.route('/games/:gid/tarot/deck/discard')
		.put(verifyToken, (req, res, next) => {
			const game = games[req.params.gid];
			const deck = game.getTarotDeck();
			const pile = game.getTarotPile();
			deck.discard(0);
			logger.log(`DISCARD card 0 for tarot in game ${req.params.gid}`);
			emitter.emit('tarot', {
				gid: req.params.gid,
				pid: req.decoded.pid,
			});
			res.statusJson(200, {
				gid: req.params.gid,
				deck: deck.toJson(),
				pile: pile.toJson(),
			});
		});

	app.route('/games/:gid/tarot/pile')
		.get(verifyToken, (req, res, next) => {
			const game = games[req.params.gid];
			const pile = game.getTarotPile();
			logger.log(`GET tarot pile in game ${req.params.gid}`);
			res.statusJson(200, {
				gid: req.params.gid,
				pile: pile.toJson(),
			});
		});

	app.route('/games/:gid/tarot/pile/flip')
		.put(verifyToken, (req, res, next) => {
			const game = games[req.params.gid];
			const pile = game.getTarotPile();
			pile.flip();
			logger.log(`FLIP tarot pile in game ${req.params.gid}`);
			emitter.emit('tarot', {
				gid: req.params.gid,
				pid: req.decoded.pid,
			});
			res.statusJson(200, {
				gid: req.params.gid,
				pile: pile.toJson(),
			});
		});

	app.route('/games/:gid/tarot/players/:pid')
		.get(verifyToken, (req, res, next) => {
			const game = games[req.params.gid];
			const player = game.getPlayer(req.params.pid);
			const hand = game.getTarotHandOfPlayer(req.params.pid);
			logger.log(`GET tarot for player ${req.params.pid} ${player} in game ${req.params.gid}`);
			res.statusJson(200, {
				gid: req.params.gid,
				pid: req.params.pid,
				player: player,
				hand: hand.toJson(),
			});
		});

	app.route('/games/:gid/tarot/players/:pid/discard')
		.put(verifyToken, (req, res, next) => {
			const game = games[req.params.gid];
			const player = game.getPlayer(req.params.pid);
			const hand = game.getTarotHandOfPlayer(req.params.pid);
			const pile = game.getTarotPile();
			logger.log(`DISCARD card 0 for tarot for player ${req.params.pid} ${player} in game ${req.params.gid}`);
			hand.discard(0);
			emitter.emit('tarot', {
				gid: req.params.gid,
				pid: req.params.pid,
				player: player,
			});
			res.statusJson(200, {
				gid: req.params.gid,
				pid: req.params.pid,
				player: player,
				pile: pile.toJson(),
				hand: hand.toJson(),
			});
		});

	app.route('/games/:gid/dump')
		.put(verifyToken, (req, res, next) => {
			const game = games[req.params.gid];
			logger.log(`DUMP game ${req.params.gid}`);
			logger('dump', game.toJson());
			res.statusJson(200, {
				gid: req.params.gid,
			});
		});

	app.use(express.static(fileURLToPath(new URL('./public', import.meta.url)), {
		index: false,
		maxAge: '1d',
		redirect: false,
	}));
	app.use((req, res, next) => {
		// no path matched.
		logger.log(`NO route for ${req.method} ${req.path}`);
		throw new AppError(404, `Cannot ${req.method} ${req.path}`);
	});
	app.use((err, req, res, next) => {
		// error handler.
		if (err instanceof AppError) {
			res.statusJson(err.code, { error: {
				message: err.message,
				cause: err.cause,
			} });
		} else {
			logger.error(err);
			res.statusJson(500, { error: {
				message: `${err.name}: ${err.message}`,
			} });
		}
	});

	return app;
}
