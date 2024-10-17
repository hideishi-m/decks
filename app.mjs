/**
Copyright (c) 2022 Hidenori ISHIKAWA. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import { randomBytes } from 'node:crypto';

import debug from 'debug';
import express from 'express';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';

import { newGame } from './game.mjs';

const secret = randomBytes(64).toString('hex');

export function newApp(emitter, name, version) {
	name = name ? `${name}:app` : 'app';
	version = version ?? '1.0.0';

	const logger = debug(name);
	const games = [];
	const tokens = [];
	const app = express();

	function sliceToken(token, length) {
		length = length ?? 40;
		if (length > token.length) {
			return token;
		}
		return token.slice(0, length / 2) + '...' + token.slice(-1 * length / 2);
	}

	function getToken(headers) {
		const authorization = headers['authorization'];
		if (undefined === authorization) {
			return undefined;
		}
		const [bearer, token] = authorization.split(' ') ?? [];
		if ('Bearer' !== bearer) {
			return undefined;
		}
		return token;
	}

	function verifyToken(req, res, next) {
		if (undefined === req.params.id) {
			res.set('WWW-Authenticate', 'Bearer error="invalid_request"');
			return res.status(400).json({ error: {
				message: 'id is not set',
				id: req.params.id
			} });
		}
		const token = getToken(req.headers);
		if (undefined === token) {
			res.set('WWW-Authenticate', `Bearer realem="${req.params.id}"`);
			return res.status(401).json({ error: {
				message: 'authorization required for id',
				id: req.params.id
			} });
		}
		try {
			const decoded = jwt.verify(token, secret);
			if (req.params.id !== decoded?.id) {
				res.set('WWW-Authenticate', `Bearer realem="${req.params.id}", error="insufficient_scope"`);
				return res.status(403).json({ error: {
					message: 'authorization failed for id',
					id: req.params.id
				} });
			}
		} catch (error) {
			logger.extend('error')(error);
			res.set('WWW-Authenticate', `Bearer realem="${req.params.id}", error="invalid_token", error_description="${error.message}"`);
			return res.status(401).json({ error: {
				message: 'authorization failed for id',
				id: req.params.id
			} });
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
	app.use(express.static(new URL('./public', import.meta.url).pathname, {
		maxAge: '1d'
	}));
	app.use(function (req, res, next) {
		logger.extend('request')({
			time: new Date(),
			ip: req.ip,
			method: req.method,
			path: req.path,
			body: req.body,
			token: sliceToken(getToken(req.headers) ?? '')
		});
		res.set({ 'Cache-Control': 'no-cache' });
		next();
	});

	app.param('id', function (req, res, next, id) {
		if (false === /^\d+$/.test(id)) {
			return res.status(400).json({ error: {
				message: 'invalid format for id',
				id: id
			} });
		}
		if (0 > parseInt(id)) {
			return res.status(400).json({ error: {
				message: 'invalid value for id',
				id: id
			} });
		}
		const game = games[id];
		if (undefined === game) {
			return res.status(404).json({ error: {
				message: 'game not found for id',
				id: id
			} });
		}
		next();
	});
	app.param('pid', function (req, res, next, pid) {
		if (false === /^\d+$/.test(pid)) {
			return res.status(400).json({ error: {
				message: 'invalid format for pid',
				pid: pid
			} });
		}
		if (0 > parseInt(pid)) {
			return res.status(400).json({ error: {
				message: 'invalid value for pid',
				pid: pid
			} });
		}
		const game = games[req.params.id];
		const players = game.getPlayers();
		const player = players[pid];
		if (undefined === player) {
			return res.status(404).json({ error: {
				message: 'player not found for pid',
				id: req.params.id,
				pid: pid
			} });
		}
		next();
	});
	app.param('cid', function (req, res, next, cid) {
		if (false === /^\d+$/.test(cid)) {
			return res.status(400).json({ error: {
				message: 'invalid format for cid',
				cid: cid
			} });
		}
		if (0 > parseInt(cid)) {
			return res.status(400).json({ error: {
				message: 'invalid value for cid',
				cid: cid
			} });
		}
		const game = games[req.params.id];
		const hand = game.getHandOf(req.params.pid);
		const card = hand.cards.at(cid);
		if (undefined === card) {
			return res.status(404).json({ error: {
				message: 'card not found for cid',
				id: req.params.id,
				pid: req.params.pid,
				cid: cid
			} });
		}
		next();
	});
	app.param('tid', function (req, res, next, tid) {
		if (false === /^\d+$/.test(tid)) {
			return res.status(400).json({ error: {
				message: 'invalid format for tid',
				tid: tid
			} });
		}
		if (0 > parseInt(tid)) {
			return res.status(400).json({ error: {
				message: 'invalid value for tid',
				tid: tid
			} });
		}
		const game = games[req.params.id];
		const players = game.getPlayers();
		const player = players[tid];
		if (undefined === player) {
			return res.status(404).json({ error: {
				message: 'player not found for tid',
				id: req.params.id,
				tid: tid
			} });
		}
		next();
	});

	app.route('/version')
		.get(function (req, res) {
			return res.status(200).json({
				version: version
			});
		})

	app.route('/games')
		.get(function (req, res) {
			const ids = [];
			games.forEach((game, index) => {
				if (undefined !== game) {
					ids.push(`${index}`);
				}
			});
			if (0 === ids.length) {
				return res.status(404).json({ error: {
					message: 'game not found'
				} });
			}
			return res.status(200).json({
				games: ids
			});
		})
		.post(function (req, res) {
			try {
				if (undefined === req.body) {
					return res.status(400).json({ error: {
						message: 'no body',
						body: req.body
					} });
				}
				if ( '[object Object]' !== Object.prototype.toString.call(req.body)) {
					return res.status(400).json({ error: {
						message: 'invalid format for body',
						body: req.body
					} });
				}
				if (false === Array.isArray(req.body.players)) {
					return res.status(400).json({ error: {
						message: 'invalid value for key',
						key: 'players',
						value: req.body.players
					} });
				}
				if (false === Array.isArray(req.body.trumps)) {
					return res.status(400).json({ error: {
						message: 'invalid value for key',
						key: 'trumps',
						value: req.body.trumps
					} });
				}
				const id = games.push(newGame(req.body.players, req.body.trumps)) - 1;
				tokens.push(jwt.sign({ id: `${id}` }, secret, { expiresIn: '1d' }));
				logger(`POST game ${id} for players ${req.body.players}`);
				return res.status(200).json({
					id: `${id}`,
					token: tokens[id]
				});
			} catch (error) {
				logger.extend('error')(error);
				return res.status(500).json({ error: {
					message: `${error.name}: ${error.message}`,
					error: error
				} });
			}
		});

	app.route('/games/:id')
		.get(function (req, res) {
			try {
				const game = games[req.params.id];
				const players = game.getPlayers();
				logger(`GET game ${req.params.id} for players ${players}`);
				return res.status(200).json({
					id: req.params.id,
					players: players
				});
			} catch (error) {
				logger.extend('error')(error);
				return res.status(500).json({ error: {
					message: `${error.name}: ${error.message}`,
					error: error
				} });
			}
		})
		.delete(function (req, res) {
			try {
				delete games[req.params.id];
				logger(`DELETE game ${req.params.id}`);
				return res.status(200).json({
					id: req.params.id
				});
			} catch (error) {
				logger.extend('error')(error);
				return res.status(500).json({ error: {
					message: `${error.name}: ${error.message}`,
					error: error
				} });
			}
		});

	app.route('/games/:id/status')
		.get(verifyToken, function (req, res) {
			try {
				const game = games[req.params.id];
				logger(`GET status in game ${req.params.id}`);
				return res.status(200).json({
					id: req.params.id,
					game: game.getStatus()
				});
			} catch (error) {
				logger.extend('error')(error);
				return res.status(500).json({ error: {
					message: `${error.name}: ${error.message}`,
					error: error
				} });
			}
		});

	app.route('/games/:id/deck')
		.get(verifyToken, function (req, res) {
			try {
				const game = games[req.params.id];
				const deck = game.getDeck();
				logger(`GET deck in game ${req.params.id}`);
				return res.status(200).json({
					id: req.params.id,
					deck: { length: deck.cards.count() }
				});
			} catch (error) {
				logger.extend('error')(error);
				return res.status(500).json({ error: {
					message: `${error.name}: ${error.message}`,
					error: error
				} });
			}
		});

	app.route('/games/:id/deck/discard')
		.put(verifyToken, function (req, res) {
			try {
				const game = games[req.params.id];
				const deck = game.getDeck();
				const pile = game.getPile();
				deck.discard(0);
				logger(`DISCARD card 0 for deck in game ${req.params.id}`);
				emitter.emit('deck', {
					id: req.params.id
				});
				emitter.emit('pile', {
					id: req.params.id,
					pile: pile.face()
				});
				return res.status(200).json({
					id: req.params.id,
					deck: { length: deck.cards.count() }
				});
			} catch (error) {
				logger.extend('error')(error);
				return res.status(500).json({ error: {
					message: `${error.name}: ${error.message}`,
					error: error
				} });
			}
		});

	app.route('/games/:id/deck/recycle')
		.put(verifyToken, function (req, res) {
			try {
				const game = games[req.params.id];
				const deck = game.getDeck();
				const pile = game.getPile();
				deck.recycle();
				logger(`RECYCLE for deck in game ${req.params.id}`);
				emitter.emit('deck', {
					id: req.params.id
				});
				emitter.emit('pile', {
					id: req.params.id,
					pile: pile.face()
				});
				return res.status(200).json({
					id: req.params.id,
					deck: { length: deck.cards.count() }
				});
			} catch (error) {
				logger.extend('error')(error);
				return res.status(500).json({ error: {
					message: `${error.name}: ${error.message}`,
					error: error
				} });
			}
		});

	app.route('/games/:id/pile')
		.get(verifyToken, function (req, res) {
			try {
				const game = games[req.params.id];
				const pile = game.getPile();
				logger(`GET pile in game ${req.params.id}`);
				return res.status(200).json({
					id: req.params.id,
					pile: { length: pile.cards.count() },
					card: pile.face()
				});
			} catch (error) {
				logger.extend('error')(error);
				return res.status(500).json({ error: {
					message: `${error.name}: ${error.message}`,
					error: error
				} });
			}
		});

	app.route('/games/:id/pile/shuffle')
		.put(verifyToken, function (req, res) {
			try {
				const game = games[req.params.id];
				const pile = game.getPile();
				game.shuffle();
				logger(`SHUFFLE pile in game ${req.params.id}`);
				emitter.emit('deck', {
					id: req.params.id
				});
				emitter.emit('pile', {
					id: req.params.id,
					pile: pile.face()
				});
				return res.status(200).json({
					id: req.params.id,
					pile: { length: pile.cards.count() },
					card: pile.face()
				});
			} catch (error) {
				logger.extend('error')(error);
				return res.status(500).json({ error: {
					message: `${error.name}: ${error.message}`,
					error: error
				} });
			}
		});

	app.route('/games/:id/players/:pid')
		.get(verifyToken, function (req, res) {
			try {
				const game = games[req.params.id];
				const players = game.getPlayers();
				const player = players[req.params.pid];
				const hand = game.getHandOf(req.params.pid);
				logger(`GET hand for player ${req.params.pid} ${player} in game ${req.params.id}`);
				return res.status(200).json({
					id: req.params.id,
					pid: req.params.pid,
					player: player,
					hand: hand.cards
				});
			} catch (error) {
				logger.extend('error')(error);
				return res.status(500).json({ error: {
					message: `${error.name}: ${error.message}`,
					error: error
				} });
			}
		});

	app.route('/games/:id/players/:pid/draw')
		.put(verifyToken, function (req, res) {
			try {
				const game = games[req.params.id];
				const players = game.getPlayers();
				const player = players[req.params.pid];
				const hand = game.getHandOf(req.params.pid);
				hand.draw();
				logger(`DRAW for player ${req.params.pid} ${player} in game ${req.params.id}`);
				emitter.emit('deck', {
					id: req.params.id,
					pid: req.params.pid,
					player: player
				});
				return res.status(200).json({
					id: req.params.id,
					pid: req.params.pid,
					player: player,
					hand: hand.cards
				});
			} catch (error) {
				logger.extend('error')(error);
				return res.status(500).json({ error: {
					message: `${error.name}: ${error.message}`,
					error: error
				} });
			}
		});

	app.route('/games/:id/players/:pid/recycle')
		.put(verifyToken, function (req, res) {
			try {
				const game = games[req.params.id];
				const players = game.getPlayers();
				const player = players[req.params.pid];
				const hand = game.getHandOf(req.params.pid);
				const pile = game.getPile();
				hand.recycle();
				logger(`RECYCLE for player ${req.params.pid} ${player} in ${req.params.id}`);
				emitter.emit('pile', {
					id: req.params.id,
					pid: req.params.pid,
					player: player,
					pile: pile.face()
				});
				return res.status(200).json({
					id: req.params.id,
					pid: req.params.pid,
					player: player,
					hand: hand.cards
				});
			} catch (error) {
				logger.extend('error')(error);
				return res.status(500).json({ error: {
					message: `${error.name}: ${error.message}`,
					error: error
				} });
			}
		});

	app.route('/games/:id/players/:pid/cards/:cid')
		.get(verifyToken, function (req, res) {
			try {
				const game = games[req.params.id];
				const players = game.getPlayers();
				const player = players[req.params.pid];
				const hand = game.getHandOf(req.params.pid);
				const card = hand.cards.at(req.params.cid);
				logger(`GET card ${req.params.cid}} for player ${req.params.pid} ${player} in game ${req.params.id}`);
				return res.status(200).json({
					id: req.params.id,
					pid: req.params.pid,
					player: player,
					cid: req.params.cid,
					card: card
				});
			} catch (error) {
				logger.extend('error')(error);
				return res.status(500).json({ error: {
					message: `${error.name}: ${error.message}`,
					error: error
				} });
			}
		});

	app.route('/games/:id/players/:pid/cards/:cid/discard')
		.put(verifyToken, function (req, res) {
			try {
				const game = games[req.params.id];
				const players = game.getPlayers();
				const player = players[req.params.pid];
				const hand = game.getHandOf(req.params.pid);
				const card = hand.cards.at(req.params.cid);
				hand.discard(req.params.cid);
				logger(`DISCARD card ${req.params.cid} for player ${req.params.pid} ${player} in game ${req.params.id}`);
				emitter.emit('pile', {
					id: req.params.id,
					pid: req.params.pid,
					player: player,
					pile: card
				});
				return res.status(200).json({
					id: req.params.id,
					pid: req.params.pid,
					player: player,
					hand: hand.cards
				});
			} catch (error) {
				logger.extend('error')(error);
				return res.status(500).json({ error: {
					message: `${error.name}: ${error.message}`,
					error: error
				} });
			}
		});

	app.route('/games/:id/players/:pid/cards/:cid/pass/:tid')
		.put(verifyToken, function (req, res) {
			try {
				const game = games[req.params.id];
				const players = game.getPlayers();
				const player = players[req.params.pid];
				const hand = game.getHandOf(req.params.pid);
				const to = players[req.params.tid];
				hand.passTo(req.params.cid, req.params.tid);
				logger(`PASS card ${req.params.cid} for player ${req.params.pid} ${player} to ${req.params.tid} ${to} in game ${req.params.id}`);
				emitter.emit('hand', {
					id: req.params.id,
					pid: req.params.pid,
					player: player,
					tid: req.params.tid
				});
				return res.status(200).json({
					id: req.params.id,
					pid: req.params.pid,
					player: player,
					hand: hand.cards
				});
			} catch (error) {
				logger.extend('error')(error);
				return res.status(500).json({ error: {
					message: `${error.name}: ${error.message}`,
					error: error
				} });
			}
		});

	app.route('/games/:id/players/:pid/pick/:tid')
		.put(verifyToken, function (req, res) {
			try {
				const game = games[req.params.id];
				const players = game.getPlayers();
				const player = players[req.params.pid];
				const hand = game.getHandOf(req.params.pid);
				const to = players[req.params.tid];
				hand.pickFrom(req.params.tid);
				logger(`PICK for player ${req.params.pid} ${player} from ${req.params.tid} ${to} in game ${req.params.id}`);
				emitter.emit('hand', {
					id: req.params.id,
					pid: req.params.pid,
					player: player,
					tid: req.params.tid
				});
				return res.status(200).json({
					id: req.params.id,
					pid: req.params.pid,
					player: player,
					hand: hand.cards
				});
			} catch (error) {
				logger.extend('error')(error);
				return res.status(500).json({ error: {
					message: `${error.name}: ${error.message}`,
					error: error
				} });
			}
		});

	app.route('/games/:id/players/:pid/trump')
		.get(verifyToken, function (req, res) {
			try {
				const game = games[req.params.id];
				const players = game.getPlayers();
				const player = players[req.params.pid];
				const trump = game.getTrumpOf(req.params.pid);
				logger(`GET trump for player ${req.params.pid} ${player} in game ${req.params.id}`);
				return res.status(200).json({
					id: req.params.id,
					pid: req.params.pid,
					player: player,
					trump: trump.face()
				});
			} catch (error) {
				logger.extend('error')(error);
				return res.status(500).json({ error: {
					message: `${error.name}: ${error.message}`,
					error: error
				} });
			}
		});

	app.route('/games/:id/players/:pid/trump/discard')
		.put(verifyToken, function (req, res) {
			try {
				const game = games[req.params.id];
				const players = game.getPlayers();
				const player = players[req.params.pid];
				const trump = game.getTrumpOf(req.params.pid);
				const tarot = game.getTarot();
				logger(`DISCARD trump for player ${req.params.pid} ${player} in game ${req.params.id}`);
				trump.discard(0);
				emitter.emit('tarot', {
					id: req.params.id,
					pid: req.params.pid,
					player: player,
					trump: tarot.face()
				});
				return res.status(200).json({
					id: req.params.id,
					pid: req.params.pid,
					player: player,
					trump: tarot.face()
				});
			} catch (error) {
				logger.extend('error')(error);
				return res.status(500).json({ error: {
					message: `${error.name}: ${error.message}`,
					error: error
				} });
			}
		});

	app.route('/games/:id/tarot')
		.get(verifyToken, function (req, res) {
			try {
				const game = games[req.params.id];
				const tarot = game.getTarot();
				logger(`GET tarot in game ${req.params.id}`);
				return res.status(200).json({
					id: req.params.id,
					tarot: { length: tarot.cards.count() },
					card: tarot.face()
				});
			} catch (error) {
				logger.extend('error')(error);
				return res.status(500).json({ error: {
					message: `${error.name}: ${error.message}`,
					error: error
				} });
			}
		});

	app.route('/games/:id/tarot/draw')
		.put(verifyToken, function (req, res) {
			try {
				const game = games[req.params.id];
				const tarot = game.getTarot();
				tarot.draw();
				logger(`DRAW tarot in game ${req.params.id}`);
				emitter.emit('tarot', {
					id: req.params.id,
					tarot: tarot.face()
				});
				return res.status(200).json({
					id: req.params.id,
					tarot: { length: tarot.cards.count() },
					card: tarot.face()
				});
			} catch (error) {
				logger.extend('error')(error);
				return res.status(500).json({ error: {
					message: `${error.name}: ${error.message}`,
					error: error
				} });
			}
		});

	app.route('/games/:id/tarot/flip')
		.put(verifyToken, function (req, res) {
			try {
				const game = games[req.params.id];
				const tarot = game.getTarot();
				tarot.flip();
				logger(`FLIP tarot in game ${req.params.id}`);
				emitter.emit('tarot', {
					id: req.params.id,
					tarot: tarot.face()
				});
				return res.status(200).json({
					id: req.params.id,
					tarot: { length: tarot.cards.count() },
					card: tarot.face()
				});
			} catch (error) {
				logger.extend('error')(error);
				return res.status(500).json({ error: {
					message: `${error.name}: ${error.message}`,
					error: error
				} });
			}
		});

	return app;
}
