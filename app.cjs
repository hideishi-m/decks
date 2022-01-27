'use strict';

const debug = require('debug');
const express = require('express');
const path = require('path');

const { newGame } = require('./games.cjs');

const app = express();
const port = 6000;
const logger = debug('app');

debug.enable('app');

const games = [];

function isTypeOf(type, value) {
	return `[object ${type}]` === Object.prototype.toString.call(value);
}

app.use(express.json({
	limit: '10mb'
}));
app.use(express.urlencoded({
	extended: true,
	limit: '10mb'
}));
app.use(function (req, res, next) {
	logger({
		time: new Date().toString(),
		method: req.method,
		path: req.path,
		body: req.body
	});
	next();
});
app.use('/', express.static(path.join(__dirname, 'public')));

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
			if (false === isTypeOf('Object', req.body)) {
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
			const id = games.push(newGame(req.body.players)) - 1;
			logger(`POST game ${id} for players ${req.body.players}`);
			return res.status(200).json({
				id: `${id}`
			});
		} catch (error) {
			logger(error);
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
			logger(error);
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
			logger(error);
			return res.status(500).json({ error: {
				message: `${error.name}: ${error.message}`,
				error: error
			} });
		}
	});

app.route('/games/:id/players/:pid')
	.get(function (req, res) {
		try {
			const game = games[req.params.id];
			const players = game.getPlayers();
			const player = players[req.params.pid];
			const hand = game.getHandOf(req.params.pid);
			logger(`GET game ${req.params.id} for player ${req.params.pid} ${player}`);
			return res.status(200).json({
				pid: req.params.pid,
				player: player,
				hand: hand.cards
			});
		} catch (error) {
			logger(error);
			return res.status(500).json({ error: {
				message: `${error.name}: ${error.message}`,
				error: error
			} });
		}
	});

app.route('/games/:id/players/:pid/draw')
	.put(function (req, res) {
		try {
			const game = games[req.params.id];
			const players = game.getPlayers();
			const player = players[req.params.pid];
			const hand = game.getHandOf(req.params.pid);
			hand.draw();
			logger(`DRAW game ${req.params.id} for player ${req.params.pid} ${player}`);
			return res.status(200).json({
				pid: req.params.pid,
				player: player,
				hand: hand.cards
			});
		} catch (error) {
			logger(error);
			return res.status(500).json({ error: {
				message: `${error.name}: ${error.message}`,
				error: error
			} });
		}
	});

app.route('/games/:id/players/:pid/discard/:cid')
	.put(function (req, res) {
		try {
			const game = games[req.params.id];
			const players = game.getPlayers();
			const player = players[req.params.pid];
			const hand = game.getHandOf(req.params.pid);
			hand.discard(req.params.cid);
			logger(`DISCARD card ${req.params.cid} in game ${req.params.id} for player ${req.params.pid} ${player}`);
			return res.status(200).json({
				pid: req.params.pid,
				player: player,
				hand: hand.cards
			});
		} catch (error) {
			logger(error);
			return res.status(500).json({ error: {
				message: `${error.name}: ${error.message}`,
				error: error
			} });
		}
	});

app.route('/games/:id/players/:pid/recycle')
	.put(function (req, res) {
		try {
			const game = games[req.params.id];
			const players = game.getPlayers();
			const player = players[req.params.pid];
			const hand = game.getHandOf(req.params.pid);
			hand.recycle();
			logger(`RECYCLE game ${req.params.id} for player ${req.params.pid} ${player}`);
			return res.status(200).json({
				pid: req.params.pid,
				player: player,
				hand: hand.cards
			});
		} catch (error) {
			logger(error);
			return res.status(500).json({ error: {
				message: `${error.name}: ${error.message}`,
				error: error
			} });
		}
	});

app.route('/games/:id/players/:pid/pass/:cid/to/:tid')
	.put(function (req, res) {
		try {
			const game = games[req.params.id];
			const players = game.getPlayers();
			const player = players[req.params.pid];
			const hand = game.getHandOf(req.params.pid);
			const to = players[req.params.tid];
			hand.passTo(req.params.cid, req.params.tid);
			logger(`PASS card ${req.params.cid} in game ${req.params.id} for player ${req.params.pid} ${player} to ${req.params.tid} ${to}`);
			return res.status(200).json({
				pid: req.params.pid,
				player: player,
				hand: hand.cards
			});
		} catch (error) {
			logger(error);
			return res.status(500).json({ error: {
				message: `${error.name}: ${error.message}`,
				error: error
			} });
		}
	});

app.route('/games/:id/players/:pid/pick/:tid')
	.put(function (req, res) {
		try {
			const game = games[req.params.id];
			const players = game.getPlayers();
			const player = players[req.params.pid];
			const hand = game.getHandOf(req.params.pid);
			const to = players[req.params.tid];
			hand.pickFrom(req.params.tid);
			logger(`PICK from ${req.params.tid} ${to} in game ${req.params.id} for player ${req.params.pid} ${player}`);
			return res.status(200).json({
				pid: req.params.pid,
				player: player,
				hand: hand.cards
			});
		} catch (error) {
			logger(error);
			return res.status(500).json({ error: {
				message: `${error.name}: ${error.message}`,
				error: error
			} });
		}
	});

app.listen(port, function () {
	logger(`Listening on port ${port}`);
});
