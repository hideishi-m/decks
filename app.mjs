/**
Copyright (c) 2022-2024 Hidenori ISHIKAWA. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { fileURLToPath } from 'node:url';

import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import jwt from 'jsonwebtoken';

import { createGame } from './game.mjs';
import { getLogger } from './logger.mjs';
import { epitaphRanks } from './public/js/LRQ_epitaph.js';

import pkgJson from './package.json' with { type: 'json' };

const MASTER = '0';
// 卓の脇に置く札の種類。POST /games では必須で、既定値は無い。
const MODES = [ 'tarot', 'epitaph', 'none' ];

class AppError extends Error {
	constructor(code = 500, message, options) {
		super(message, options);
		this.code = code;
	}
}

export function createApp(emitter, options) {

	function validateId(req, res, next, value, key) {
		// \d は ASCII の 0-9 だけなので、通れば必ず 0 以上。範囲の検査は要らない。
		if (false === /^\d+$/.test(value)) {
			throw new AppError(400, `invalid format for ${key}`, { cause: { [key]: value } });
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

	// 省略も 400。
	function validateMode(req, res, next, value, key) {
		if (false === MODES.includes(value)) {
			throw new AppError(400, `invalid value for ${key}`, { cause: { [key]: value } });
		}
		next();
	}

	// tarots を見るのはタロットの卓だけ。ほかの卓では省略してよく、送られても使わない。
	function validateTarots(req, res, next, value, key) {
		if ('tarot' !== req.body?.mode) {
			return next();
		}
		return validateArray(req, res, next, value, key);
	}

	// epitaphs を見るのはエピタフの卓だけ。空の配列は許し、知らない番号と重複は受け付けない。
	function validateEpitaphs(req, res, next, value, key) {
		if ('epitaph' !== req.body?.mode) {
			return next();
		}
		const valid = Array.isArray(value)
			&& value.every((rank) => epitaphRanks.has(rank))
			&& value.length === new Set(value).size;
		if (false === valid) {
			throw new AppError(400, `invalid value for ${key}`, { cause: { [key]: value } });
		}
		next();
	}

	function validateEpitaph(req, res, next, value, key) {
		const epitaphs = games[req.params.gid].getEpitaphs();
		if (undefined === epitaphs.at(value)) {
			throw new AppError(404, 'epitaph not found for eid', { cause: {
				gid: req.params.gid,
				[key]: value,
			} });
		}
		next();
	}

	// 卓の脇に置く札を、createGame の引数の形にする（game.mjs の modeOf と対）。
	function sideOf(body) {
		switch (body.mode) {
			case 'none':
				return false;
			case 'epitaph':
				return { epitaphs: body.epitaphs };
			default:  // tarot（validateMode を通った後なので 3 つのどれか）
				return body.tarots;
		}
	}

	// 管理面で 1 卓を表す形。POST /games と GET /games/:gid が同じものを返す。
	// 入場券と、裏のものも含めたエピタフを返すので、前段で保護すること。
	function describeGame(gid) {
		const game = games[gid];
		return {
			gid: `${gid}`,
			players: game.getAllPlayers(),
			mode: game.getMode(),
			epitaphs: game.getEpitaphs().ranks(),
			ticket: tickets[gid],
		};
	}

	// 卓への入場券。卓を作ったときに 1 つだけ発行し、以後は再発行しない。
	// これを知っている人だけが席のトークンを取れる。
	function createTicket() {
		return randomBytes(16).toString('base64url');
	}

	// 合う卓の gid を返す。無ければ undefined。
	function findTicket(ticket) {
		const given = Buffer.from(ticket);
		for (let gid = 0; gid < tickets.length; gid++) {
			if (undefined === tickets[gid]) {
				continue;
			}
			const known = Buffer.from(tickets[gid]);
			// 長さが違うと timingSafeEqual は投げるので先に見る。
			if (known.length === given.length && timingSafeEqual(known, given)) {
				return `${gid}`;
			}
		}
		return undefined;
	}

	// 入場の検査。通ったら req.gid にどの卓かを入れる。
	// クライアントは gid を送らないので、卓を決めるのは ticket だけ。
	function verifyTicket(req, res, next) {
		const ticket = req.ticket();
		if (undefined === ticket) {
			res.set('WWW-Authenticate', 'Ticket realm="/join"');
			throw new AppError(401, 'ticket required');
		}
		const gid = findTicket(ticket);
		if (undefined === gid) {
			res.set('WWW-Authenticate', 'Ticket realm="/join", error="invalid_ticket"');
			throw new AppError(401, 'ticket not accepted');
		}
		req.gid = gid;
		next();
	}

	// 場のエピタフを表にする・裏にするのはマスターだけ。
	// 席同士は保護しない（入場券があればマスターの席にもなれる）ので、誤操作よけ。
	function verifyMaster(req, res, next) {
		if (MASTER !== req.decoded.pid) {
			throw new AppError(403, 'only the master may turn epitaphs', { cause: { pid: req.decoded.pid } });
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

	// WebSocket へ流す 1 アクション。受け取った側が再フェッチせずに
	// 卓を描き直せるよう、公開状態（table）を丸ごと載せる。
	// card に入れてよいのは「場に表で出た札」だけ。伏せたままの札は載せない。
	function emitAction(req, type, extra) {
		const gid = req.params.gid;
		const game = games[gid];
		seqs[gid] = (seqs[gid] ?? 0) + 1;
		emitter.emit('action', {
			seq: seqs[gid],
			at: new Date().toISOString(),
			type: type,
			gid: gid,
			pid: req.params.pid ?? req.decoded.pid,
			player: game.getPlayer(req.params.pid ?? req.decoded.pid),
			tid: req.params.tid ?? null,
			target: undefined !== req.params.tid ? game.getPlayer(req.params.tid) : null,
			card: extra?.card ?? null,
			table: game.getTable().toJson(),
		});
	}

	const logger = getLogger(`${pkgJson.name}:app`);
	const games = [];
	const seqs = [];
	const tickets = [];

	// 席とカードの検査は verifyToken の後ろに置く。app.param は認証より先に
	// 走るため、param に置くと 404 と 401 の差で席数と手札の枚数を測られる。
	const checkPlayer = partialReqKey(validatePlayer, ['params', 'pid']);
	const checkTarget = partialReqKey(validatePlayer, ['params', 'tid']);
	const checkCard = partialReqKey(validateCard, ['params', 'cid']);
	const checkEpitaph = partialReqKey(validateEpitaph, ['params', 'eid']);
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
	app.request.ticket = function () {
		const authorization = this.get('authorization');
		if (undefined === authorization) {
			return undefined;
		}
		const [scheme, ticket] = authorization.split(' ') ?? [];
		if ('Ticket' !== scheme) {
			return undefined;
		}
		return ticket;
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

	// 形だけを見る。存在の確認は各ルートの verifyToken の後ろで行う。
	app.param('pid', validateId);
	app.param('cid', validateId);
	app.param('tid', validateId);
	app.param('eid', validateId);

	app.route('/version')
		.get((req, res, next) => {
			res.statusJson(200, {
				version: pkgJson.version,
			});
		});

	app.route('/join')
		.get(verifyTicket, (req, res, next) => {
			const game = games[req.gid];
			const players = game.getAllPlayers();
			logger.log(`JOIN game ${req.gid} for players ${players}`);
			res.statusJson(200, {
				gid: req.gid,
				players: players,
			});
		});

	app.route('/token')
		.post(verifyTicket, partialReqKey(validateId, ['body', 'pid']), (req, res, next) => {
			const game = games[req.gid];
			if (undefined === game.getPlayer(req.body.pid)) {
				throw new AppError(404, 'player not found for pid', { cause: {
					pid: req.body.pid,
				} });
			}
			const token = jwt.sign({
				gid: req.gid,
				pid: `${req.body.pid}`,
			}, secret, { expiresIn: '1d' });
			logger.log(`POST token for player ${req.body.pid} in game ${req.gid}`);
			res.statusJson(200, {
				token: token,
			});
		});

	// 管理面。一覧は gid だけを返す。卓の中身を載せないので、応答は卓の
	// 数にしか比例しない。席と入場券は GET /games/:gid が 1 卓ずつ返す。
	// POST は入場券を返すので、前段（nginx 等）で保護すること。
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
		.post(partialReqKey(validateArray, ['body', 'players']), partialReqKey(validateMode, ['body', 'mode']), partialReqKey(validateTarots, ['body', 'tarots']), partialReqKey(validateEpitaphs, ['body', 'epitaphs']), (req, res, next) => {
			const gid = games.push(createGame(req.body.players, sideOf(req.body))) - 1;
			tickets[gid] = createTicket();
			logger.log(`POST game ${gid} for players ${req.body.players}`);
			// GET /games/:gid と同じ形で返すので、作った直後に引き直さなくてよい。
			res.statusJson(200, describeGame(gid));
		});

	// 1 卓ぶん。一覧は gid だけなので、席と入場券はここで引く。
	// 入場券を返すので、前段で保護すること。
	app.route('/games/:gid')
		.get((req, res, next) => {
			const game = games[req.params.gid];
			logger.log(`GET game ${req.params.gid} for players ${game.getAllPlayers()}`);
			res.statusJson(200, describeGame(req.params.gid));
		})
		.delete((req, res, next) => {
			delete games[req.params.gid];
			delete seqs[req.params.gid];
			delete tickets[req.params.gid];
			logger.log(`DELETE game ${req.params.gid}`);
			res.statusJson(200, {
				gid: req.params.gid,
			});
		});

	app.route('/games/:gid/table')
		.get(verifyToken, (req, res, next) => {
			// :pid を含まないので verifyToken は gid だけを照合する。
			const game = games[req.params.gid];
			const table = game.getTable();
			logger.log(`GET table in game ${req.params.gid}`);
			res.statusJson(200, {
				gid: req.params.gid,
				...table.toJson(),
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
			emitAction(req, 'deck-discard', { card: pile.toJson().card });
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
			// 戻した札は伏せに戻るので card は載せない。
			emitAction(req, 'deck-recycle');
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
			emitAction(req, 'shuffle');
			res.statusJson(200, {
				gid: req.params.gid,
				deck: deck.toJson(),
				pile: pile.toJson(),
			});
		});

	app.route('/games/:gid/players/:pid')
		.get(verifyToken, checkPlayer, (req, res, next) => {
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
		.put(verifyToken, checkPlayer, (req, res, next) => {
			const game = games[req.params.gid];
			const player = game.getPlayer(req.params.pid);
			const hand = game.getHandOfPlayer(req.params.pid);
			const deck = game.getDeck();
			hand.draw();
			logger.log(`DRAW for player ${req.params.pid} ${player} in game ${req.params.gid}`);
			// 引いた札は手札に入るので card は載せない。
			emitAction(req, 'draw');
			res.statusJson(200, {
				gid: req.params.gid,
				pid: req.params.pid,
				player: player,
				deck: deck.toJson(),
				hand: hand.toJson(),
			});
		});

	app.route('/games/:gid/players/:pid/recycle')
		.put(verifyToken, checkPlayer, (req, res, next) => {
			const game = games[req.params.gid];
			const player = game.getPlayer(req.params.pid);
			const hand = game.getHandOfPlayer(req.params.pid);
			const pile = game.getPile();
			hand.recycle();
			const taken = hand.at(hand.toJson().length - 1);
			logger.log(`RECYCLE for player ${req.params.pid} ${player} in ${req.params.gid}`);
			// 捨て札の一番上は全員が見ていた札なので、そのまま載せてよい。
			emitAction(req, 'recycle', { card: taken });
			res.statusJson(200, {
				gid: req.params.gid,
				pid: req.params.pid,
				player: player,
				pile: pile.toJson(),
				hand: hand.toJson(),
			});
		});

	app.route('/games/:gid/players/:pid/cards/:cid')
		.get(verifyToken, checkPlayer, checkCard, (req, res, next) => {
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
		.put(verifyToken, checkPlayer, checkCard, (req, res, next) => {
			const game = games[req.params.gid];
			const player = game.getPlayer(req.params.pid);
			const hand = game.getHandOfPlayer(req.params.pid);
			const pile = game.getPile();
			hand.discard(req.params.cid);
			logger.log(`DISCARD card ${req.params.cid} for player ${req.params.pid} ${player} in game ${req.params.gid}`);
			emitAction(req, 'discard', { card: pile.toJson().card });
			res.statusJson(200, {
				gid: req.params.gid,
				pid: req.params.pid,
				player: player,
				pile: pile.toJson(),
				hand: hand.toJson(),
			});
		});

	app.route('/games/:gid/players/:pid/cards/:cid/pass/:tid')
		.put(verifyToken, checkPlayer, checkCard, checkTarget, (req, res, next) => {
			const game = games[req.params.gid];
			const player = game.getPlayer(req.params.pid);
			const hand = game.getHandOfPlayer(req.params.pid);
			const playerTo = game.getPlayer(req.params.tid);
			hand.passTo(req.params.cid, req.params.tid);
			logger.log(`PASS card ${req.params.cid} for player ${req.params.pid} ${player} to ${req.params.tid} ${playerTo} in game ${req.params.gid}`);
			// 渡した札は相手の手札に入るので card は載せない。
			emitAction(req, 'pass');
			res.statusJson(200, {
				gid: req.params.gid,
				pid: req.params.pid,
				player: player,
				hand: hand.toJson(),
			});
		});

	app.route('/games/:gid/players/:pid/pick/:tid')
		.put(verifyToken, checkPlayer, checkTarget, (req, res, next) => {
			const game = games[req.params.gid];
			const player = game.getPlayer(req.params.pid);
			const hand = game.getHandOfPlayer(req.params.pid);
			const playerFrom = game.getPlayer(req.params.tid);
			hand.pickFrom(req.params.tid);
			logger.log(`PICK for player ${req.params.pid} ${player} from ${req.params.tid} ${playerFrom} in game ${req.params.gid}`);
			// 抜いた札は自分の手札に入るので card は載せない。
			emitAction(req, 'pick');
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
			emitAction(req, 'tarot-deck-discard', { card: pile.toJson().card });
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
			emitAction(req, 'tarot-flip', { card: pile.toJson().card });
			res.statusJson(200, {
				gid: req.params.gid,
				pile: pile.toJson(),
			});
		});

	app.route('/games/:gid/tarot/players/:pid')
		.get(verifyToken, checkPlayer, (req, res, next) => {
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
		.put(verifyToken, checkPlayer, (req, res, next) => {
			const game = games[req.params.gid];
			const player = game.getPlayer(req.params.pid);
			const hand = game.getTarotHandOfPlayer(req.params.pid);
			const pile = game.getTarotPile();
			logger.log(`DISCARD card 0 for tarot for player ${req.params.pid} ${player} in game ${req.params.gid}`);
			hand.discard(0);
			emitAction(req, 'tarot-discard', { card: pile.toJson().card });
			res.statusJson(200, {
				gid: req.params.gid,
				pid: req.params.pid,
				player: player,
				pile: pile.toJson(),
				hand: hand.toJson(),
			});
		});

	// 場のエピタフ。マスターには裏の札も番号つきで返し、ほかの席には卓と同じものを返す。
	app.route('/games/:gid/epitaphs')
		.get(verifyToken, (req, res, next) => {
			const epitaphs = games[req.params.gid].getEpitaphs();
			logger.log(`GET epitaphs in game ${req.params.gid}`);
			res.statusJson(200, {
				gid: req.params.gid,
				epitaphs: epitaphs.toJson(MASTER === req.decoded.pid),
			});
		});

	app.route('/games/:gid/epitaphs/:eid/open')
		.put(verifyToken, verifyMaster, checkEpitaph, (req, res, next) => {
			const epitaphs = games[req.params.gid].getEpitaphs();
			epitaphs.open(req.params.eid);
			logger.log(`OPEN epitaph ${req.params.eid} in game ${req.params.gid}`);
			emitAction(req, 'epitaph-open', { card: {
				eid: req.params.eid,
				...epitaphs.toJson(false)[req.params.eid],
			} });
			res.statusJson(200, {
				gid: req.params.gid,
				epitaphs: epitaphs.toJson(true),
			});
		});

	app.route('/games/:gid/epitaphs/:eid/close')
		.put(verifyToken, verifyMaster, checkEpitaph, (req, res, next) => {
			const epitaphs = games[req.params.gid].getEpitaphs();
			epitaphs.close(req.params.eid);
			logger.log(`CLOSE epitaph ${req.params.eid} in game ${req.params.gid}`);
			// 裏にした札は、配信に rank を載せない。
			emitAction(req, 'epitaph-close', { card: {
				eid: req.params.eid,
				...epitaphs.toJson(false)[req.params.eid],
			} });
			res.statusJson(200, {
				gid: req.params.gid,
				epitaphs: epitaphs.toJson(true),
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

	// 本番は nginx が try_files で public/ を直接返す（expires 1d はそちらで付く）。
	// ここが効くのは直起動したときだけなので、キャッシュさせない。
	// maxAge を付けると、変更した js/css が古いまま読まれて原因が分かりにくくなる。
	app.use(express.static(fileURLToPath(new URL('./public', import.meta.url)), {
		index: false,
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
