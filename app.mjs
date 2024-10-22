/**
Copyright (c) 2022-2024 Hidenori ISHIKAWA. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import debug from 'debug';
import express from 'express';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import serveStatic from 'serve-static';

import { createGame } from './game.mjs';

const secret = randomBytes(64).toString('hex');

export function createApp(emitter, name, version) {
	name = name ? `${name}:app` : 'app';
	version = version ?? '1.0.0';

	const logger = debug(name);
	const games = [];
	const app = express();

	app.request.token = function () {
		const authorization = this.get('authorization');
		if (undefined === authorization) {
			return null;
		}
		const [bearer, token] = authorization.split(' ') ?? [];
		if ('Bearer' !== bearer) {
			return null;
		}
		return token ?? null;
	};
	app.response.statusJson = function (code, body) {
		logger.extend('response')({
			time: new Date(),
			route: this.req.route?.path,
			status: code,
			body: body
		});
		this.set('Cache-Control', 'no-cache');
		return this.status(code).json(body);
	};

	function verifyToken(req, res, next) {
		let decoded;

		if (null === req.token()) {
			res.set('WWW-Authenticate', `Bearer realem="/games"`);
			return res.statusJson(401, { error: { message: 'authorization required' } });
		}
		try {
			decoded = jwt.verify(req.token(), secret);
		} catch (error) {
			logger.extend('error')(error);
			res.set('WWW-Authenticate', `Bearer realem="/games", error="invalid_token", error_description="${error.message}"`);
			return res.statusJson(401, { error: { message: 'authorization failed' } });
		}

		// req.params.gid
		if (undefined !== req.params.gid) {
			if (req.params.gid !== decoded?.gid) {
				res.set('WWW-Authenticate', `Bearer realem="id: ${req.params.gid}", error="insufficient_scope"`);
				return res.statusJson(403, { error: {
					message: `authorization failed for gid`,
					gid: req.params.gid
				} });
			}
		}

		// req.params.pid
		if (undefined !== req.params.pid) {
			if (req.params.pid !== decoded?.pid) {
				res.set('WWW-Authenticate', `Bearer realem="pid: ${req.params.pid}", error="insufficient_scope"`);
				return res.statusJson(403, { error: {
					message: `authorization failed for pid`,
					pid: req.params.pid
				} });
			}
		}

		next();
	}

	app.set('trust proxy', 'loopback, uniquelocal');
	app.disable('x-powered-by');
	app.disable('etag');
	app.use(helmet());
	app.use(express.json({
		limit: '10mb'
	}));
	app.use(express.urlencoded({
		extended: true,
		limit: '10mb'
	}));
	app.use(serveStatic(fileURLToPath(new URL('./public', import.meta.url)), {
		index: false,
		maxAge: '1d',
		redirect: false
	}));

	app.use(function (req, res, next) {
		logger.extend('request')({
			time: new Date(),
			ip: req.ip,
			method: req.method,
			path: req.path,
			token: req.token(),
			body: req.body
		});
		next();
	});

	app.param('gid', function (req, res, next, gid) {
		if (false === /^\d+$/.test(gid)) {
			return res.statusJson(400, { error: {
				message: 'invalid format for gid',
				gid: gid
			} });
		}
		if (0 > parseInt(gid)) {
			return res.statusJson(400, { error: {
				message: 'invalid value for gid',
				gid: gid
			} });
		}
		const game = games[gid];
		if (undefined === game) {
			return res.statusJson(404, { error: {
				message: 'game not found for gid',
				gid: gid
			} });
		}
		next();
	});
	app.param('pid', function (req, res, next, pid) {
		if (false === /^\d+$/.test(pid)) {
			return res.statusJson(400, { error: {
				message: 'invalid format for pid',
				pid: pid
			} });
		}
		if (0 > parseInt(pid)) {
			return res.statusJson(400, { error: {
				message: 'invalid value for pid',
				pid: pid
			} });
		}
		const game = games[req.params.gid];
		const players = game.getPlayers();
		const player = players[pid];
		if (undefined === player) {
			return res.statusJson(404, { error: {
				message: 'player not found for pid',
				gid: req.params.gid,
				pid: pid
			} });
		}
		next();
	});
	app.param('cid', function (req, res, next, cid) {
		if (false === /^\d+$/.test(cid)) {
			return res.statusJson(400, { error: {
				message: 'invalid format for cid',
				cid: cid
			} });
		}
		if (0 > parseInt(cid)) {
			return res.statusJson(400, { error: {
				message: 'invalid value for cid',
				cid: cid
			} });
		}
		const game = games[req.params.gid];
		const hand = game.getHandOf(req.params.pid);
		const card = hand.at(cid);
		if (undefined === card) {
			return res.statusJson(404, { error: {
				message: 'card not found for cid',
				gid: req.params.gid,
				pid: req.params.pid,
				cid: cid
			} });
		}
		next();
	});
	app.param('tid', function (req, res, next, tid) {
		if (false === /^\d+$/.test(tid)) {
			return res.statusJson(400, { error: {
				message: 'invalid format for tid',
				tid: tid
			} });
		}
		if (0 > parseInt(tid)) {
			return res.statusJson(400, { error: {
				message: 'invalid value for tid',
				tid: tid
			} });
		}
		const game = games[req.params.gid];
		const players = game.getPlayers();
		const player = players[tid];
		if (undefined === player) {
			return res.statusJson(404, { error: {
				message: 'player not found for tid',
				gid: req.params.gid,
				tid: tid
			} });
		}
		next();
	});

	app.route('/version')
		.get(function (req, res, next) {
			return res.statusJson(200, {
				version: version
			});
		})

	app.route('/token')
		.post(function (req, res, next) {
			if (undefined === req.body) {
				return res.statusJson(400, { error: {
					message: 'no body',
					body: req.body
				} });
			}
			if ( '[object Object]' !== Object.prototype.toString.call(req.body)) {
				return res.statusJson(400, { error: {
					message: 'invalid format for body',
					body: req.body
				} });
			}
			if (false === /^\d+$/.test(req.body.gid)) {
				return res.statusJson(400, { error: {
					message: 'invalid format for gid',
					gid: req.body.gid
				} });
			}
			if (0 > parseInt(req.body.gid)) {
				return res.statusJson(400, { error: {
					message: 'invalid value for gid',
					gid: req.body.gid
				} });
			}
			if (false === /^\d+$/.test(req.body.pid)) {
				return res.statusJson(400, { error: {
					message: 'invalid format for pid',
					pid: req.body.pid
				} });
			}
			if (0 > parseInt(req.body.pid)) {
				return res.statusJson(400, { error: {
					message: 'invalid value for pid',
					pid: req.body.pid
				} });
			}
			const token = jwt.sign({
				gid: `${req.body.gid}`,
				pid: `${req.body.pid}`
			}, secret, { expiresIn: '1d' });
			logger(`POST token for player ${req.body.pid} in game ${req.body.gid}`);
			return res.statusJson(200, {
				gid: req.body.gid,
				pid: req.body.pid,
				token: token
			});
		});

	app.route('/games')
		.get(function (req, res, next) {
			const gids = [];
			games.forEach((game, index) => {
				if (undefined !== game) {
					gids.push(`${index}`);
				}
			});
			if (0 === gids.length) {
				return res.statusJson(404, { error: {
					message: 'game not found'
				} });
			}
			return res.statusJson(200, {
				games: gids
			});
		})
		.post(verifyToken, function (req, res, next) {
			if (undefined === req.body) {
				return res.statusJson(400, { error: {
					message: 'no body',
					body: req.body
				} });
			}
			if ( '[object Object]' !== Object.prototype.toString.call(req.body)) {
				return res.statusJson(400, { error: {
					message: 'invalid format for body',
					body: req.body
				} });
			}
			if (false === Array.isArray(req.body.players)) {
				return res.statusJson(400, { error: {
					message: 'invalid value for key',
					key: 'players',
					value: req.body.players
				} });
			}
			if (false === Array.isArray(req.body.tarots)) {
				return res.statusJson(400, { error: {
					message: 'invalid value for key',
					key: 'tarots',
					value: req.body.tarots
				} });
			}
			const gid = games.push(createGame(req.body.players, req.body.tarots)) - 1;
			logger(`POST game ${gid} for players ${req.body.players}`);
			return res.statusJson(200, {
				gid: `${gid}`
			});
		});

	app.route('/games/:gid')
		.get(function (req, res, next) {
			const game = games[req.params.gid];
			const players = game.getPlayers();
			logger(`GET game ${req.params.gid} for players ${players}`);
			return res.statusJson(200, {
				gid: req.params.gid,
				players: players
			});
		})
		.delete(verifyToken, function (req, res, next) {
			delete games[req.params.gid];
			logger(`DELETE game ${req.params.gid}`);
			return res.statusJson(200, {
				gid: req.params.gid
			});
		});

	app.route('/games/:gid/status')
		.get(verifyToken, function (req, res, next) {
			const game = games[req.params.gid];
			logger(`GET status in game ${req.params.gid}`);
			return res.statusJson(200, {
				gid: req.params.gid,
				game: game.getStatus()
			});
		});

	app.route('/games/:gid/deck')
		.get(verifyToken, function (req, res, next) {
			const game = games[req.params.gid];
			const deck = game.getDeck();
			logger(`GET deck in game ${req.params.gid}`);
			return res.statusJson(200, {
				gid: req.params.gid,
				deck: { length: deck.count() }
			});
		});

	app.route('/games/:gid/deck/discard')
		.put(verifyToken, function (req, res, next) {
			const game = games[req.params.gid];
			const deck = game.getDeck();
			deck.discard(0);
			logger(`DISCARD card 0 for deck in game ${req.params.gid}`);
			emitter.emit('deck', {
				gid: req.params.gid
			});
			emitter.emit('pile', {
				gid: req.params.gid
			});
			return res.statusJson(200, {
				gid: req.params.gid,
				deck: { length: deck.count() }
			});
		});

	app.route('/games/:gid/deck/recycle')
		.put(verifyToken, function (req, res, next) {
			const game = games[req.params.gid];
			const deck = game.getDeck();
			deck.recycle();
			logger(`RECYCLE for deck in game ${req.params.gid}`);
			emitter.emit('deck', {
				gid: req.params.gid
			});
			emitter.emit('pile', {
				gid: req.params.gid
			});
			return res.statusJson(200, {
				gid: req.params.gid,
				deck: { length: deck.count() }
			});
		});

	app.route('/games/:gid/pile')
		.get(verifyToken, function (req, res, next) {
			const game = games[req.params.gid];
			const pile = game.getPile();
			logger(`GET pile in game ${req.params.gid}`);
			return res.statusJson(200, {
				gid: req.params.gid,
				pile: {
					length: pile.count(),
					card: pile.face()
				}
			});
		});

	app.route('/games/:gid/pile/shuffle')
		.put(verifyToken, function (req, res, next) {
			const game = games[req.params.gid];
			const pile = game.getPile();
			pile.shuffle();
			logger(`SHUFFLE pile in game ${req.params.gid}`);
			emitter.emit('deck', {
				gid: req.params.gid
			});
			emitter.emit('pile', {
				gid: req.params.gid
			});
			return res.statusJson(200, {
				gid: req.params.gid,
				pile: {
					length: pile.count(),
					card: pile.face()
				}
			});
		});

	app.route('/games/:gid/players/:pid')
		.get(verifyToken, function (req, res, next) {
			const game = games[req.params.gid];
			const players = game.getPlayers();
			const player = players[req.params.pid];
			const hand = game.getHandOf(req.params.pid);
			logger(`GET hand for player ${req.params.pid} ${player} in game ${req.params.gid}`);
			return res.statusJson(200, {
				gid: req.params.gid,
				pid: req.params.pid,
				player: player,
				hand: {
					length: hand.count(),
					cards: hand.cards()
				}
			});
		});

	app.route('/games/:gid/players/:pid/draw')
		.put(verifyToken, function (req, res, next) {
			const game = games[req.params.gid];
			const players = game.getPlayers();
			const player = players[req.params.pid];
			const hand = game.getHandOf(req.params.pid);
			hand.draw();
			logger(`DRAW for player ${req.params.pid} ${player} in game ${req.params.gid}`);
			emitter.emit('deck', {
				gid: req.params.gid,
				pid: req.params.pid,
				player: player
			});
			return res.statusJson(200, {
				gid: req.params.gid,
				pid: req.params.pid,
				player: player,
				hand: {
					length: hand.count(),
					cards: hand.cards()
				}
			});
		});

	app.route('/games/:gid/players/:pid/recycle')
		.put(verifyToken, function (req, res, next) {
			const game = games[req.params.gid];
			const players = game.getPlayers();
			const player = players[req.params.pid];
			const hand = game.getHandOf(req.params.pid);
			hand.recycle();
			logger(`RECYCLE for player ${req.params.pid} ${player} in ${req.params.gid}`);
			emitter.emit('pile', {
				gid: req.params.gid,
				pid: req.params.pid,
				player: player
			});
			return res.statusJson(200, {
				gid: req.params.gid,
				pid: req.params.pid,
				player: player,
				hand: {
					length: hand.count(),
					cards: hand.cards()
				}
			});
		});

	app.route('/games/:gid/players/:pid/cards/:cid')
		.get(verifyToken, function (req, res, next) {
			const game = games[req.params.gid];
			const players = game.getPlayers();
			const player = players[req.params.pid];
			const hand = game.getHandOf(req.params.pid);
			const card = hand.at(req.params.cid);
			logger(`GET card ${req.params.cid}} for player ${req.params.pid} ${player} in game ${req.params.gid}`);
			return res.statusJson(200, {
				gid: req.params.gid,
				pid: req.params.pid,
				player: player,
				cid: req.params.cid,
				card: card
			});
		});

	app.route('/games/:gid/players/:pid/cards/:cid/discard')
		.put(verifyToken, function (req, res, next) {
			const game = games[req.params.gid];
			const players = game.getPlayers();
			const player = players[req.params.pid];
			const hand = game.getHandOf(req.params.pid);
			hand.discard(req.params.cid);
			logger(`DISCARD card ${req.params.cid} for player ${req.params.pid} ${player} in game ${req.params.gid}`);
			emitter.emit('pile', {
				gid: req.params.gid,
				pid: req.params.pid,
				player: player
			});
			return res.statusJson(200, {
				gid: req.params.gid,
				pid: req.params.pid,
				player: player,
				hand: {
					length: hand.count(),
					cards: hand.cards()
				}
			});
		});

	app.route('/games/:gid/players/:pid/cards/:cid/pass/:tid')
		.put(verifyToken, function (req, res, next) {
			const game = games[req.params.gid];
			const players = game.getPlayers();
			const player = players[req.params.pid];
			const hand = game.getHandOf(req.params.pid);
			const playerTo = players[req.params.tid];
			hand.passTo(req.params.cid, req.params.tid);
			logger(`PASS card ${req.params.cid} for player ${req.params.pid} ${player} to ${req.params.tid} ${playerTo} in game ${req.params.gid}`);
			emitter.emit('hand', {
				gid: req.params.gid,
				pid: req.params.pid,
				player: player,
				tid: req.params.tid,
				playerTo: playerTo
			});
			return res.statusJson(200, {
				gid: req.params.gid,
				pid: req.params.pid,
				player: player,
				hand: {
					length: hand.count(),
					cards: hand.cards()
				}
			});
		});

	app.route('/games/:gid/players/:pid/pick/:tid')
		.put(verifyToken, function (req, res, next) {
			const game = games[req.params.gid];
			const players = game.getPlayers();
			const player = players[req.params.pid];
			const hand = game.getHandOf(req.params.pid);
			const playerTo = players[req.params.tid];
			hand.pickFrom(req.params.tid);
			logger(`PICK for player ${req.params.pid} ${player} from ${req.params.tid} ${playerTo} in game ${req.params.gid}`);
			emitter.emit('hand', {
				gid: req.params.gid,
				pid: req.params.pid,
				player: player,
				tid: req.params.tid,
				playerTo: playerTo
			});
			return res.statusJson(200, {
				gid: req.params.gid,
				pid: req.params.pid,
				player: player,
				hand: {
					length: hand.count(),
					cards: hand.cards()
				}
			});
		});

	app.route('/games/:gid/tarot/deck')
		.get(verifyToken, function (req, res, next) {
			const game = games[req.params.gid];
			const deck = game.getTarotDeck();
			logger(`GET tarot deck in game ${req.params.gid}`);
			return res.statusJson(200, {
				gid: req.params.gid,
				deck: { length: deck.count() }
			});
		});

	app.route('/games/:gid/tarot/deck/discard')
		.put(verifyToken, function (req, res, next) {
			const game = games[req.params.gid];
			const deck = game.getTarotDeck();
			deck.discard(0);
			logger(`DISCARD card 0 for tarot in game ${req.params.gid}`);
			emitter.emit('tarot', {
				gid: req.params.gid
			});
			return res.statusJson(200, {
				gid: req.params.gid,
				deck: { length: deck.count() }
			});
		});

	app.route('/games/:gid/tarot/pile')
		.get(verifyToken, function (req, res, next) {
			const game = games[req.params.gid];
			const pile = game.getTarotPile();
			logger(`GET tarot pile in game ${req.params.gid}`);
			return res.statusJson(200, {
				gid: req.params.gid,
				pile: {
					length: pile.count(),
					card: pile.face()
				}
			});
		});

	app.route('/games/:gid/tarot/pile/flip')
		.put(verifyToken, function (req, res, next) {
			const game = games[req.params.gid];
			const pile = game.getTarotPile();
			pile.flip();
			logger(`FLIP tarot pile in game ${req.params.gid}`);
			emitter.emit('tarot', {
				gid: req.params.gid
			});
			return res.statusJson(200, {
				gid: req.params.gid,
				pile: {
					length: pile.count(),
					card: pile.face()
				}
			});
		});

	app.route('/games/:gid/tarot/players/:pid')
		.get(verifyToken, function (req, res, next) {
			const game = games[req.params.gid];
			const players = game.getPlayers();
			const player = players[req.params.pid];
			const hand = game.getTarotHandOf(req.params.pid);
			logger(`GET tarot for player ${req.params.pid} ${player} in game ${req.params.gid}`);
			return res.statusJson(200, {
				gid: req.params.gid,
				pid: req.params.pid,
				player: player,
				hand: {
					length: hand.count(),
					cards: hand.cards()
				}
			});
		});

	app.route('/games/:gid/tarot/players/:pid/discard')
		.put(verifyToken, function (req, res, next) {
			const game = games[req.params.gid];
			const players = game.getPlayers();
			const player = players[req.params.pid];
			const hand = game.getTarotHandOf(req.params.pid);
			logger(`DISCARD card 0 for tarot for player ${req.params.pid} ${player} in game ${req.params.gid}`);
			hand.discard(0);
			emitter.emit('tarot', {
				gid: req.params.gid,
				pid: req.params.pid,
				player: player
			});
			return res.statusJson(200, {
				gid: req.params.gid,
				pid: req.params.pid,
				player: player,
				hand: {
					length: hand.count(),
					cards: hand.cards()
				}
			});
		});

	app.use(function (req, res, next) {
		return res.statusJson(404, { error: {
			message: `Cannot ${req.method} ${req.path}`
		} });
	});

	app.use(function (err, req, res, next) {
		logger.extend('error')(err);
		return res.statusJson(500, { error: {
			message: `${err.name}: ${err.message}`
		} });
	});

	return app;
}
