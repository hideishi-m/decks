'use strict';

const debug = require('debug');
const logger = debug('test');
debug.enable('test');

const { newGame } = require('../game.cjs');

const game = newGame(['DEIRmen', 'Litzia', 'yuzuki']);
logger(game.getStatus());

for (let i = 0; i < game.players.length; i++) {
	const hand = game.getHandOf(i);
	hand.draw();
	hand.discard(i);
}
logger(game.getStatus());

game.getHandOf(0).passTo(0, 3);
game.getHandOf(1).pickFrom(2);
logger(game.getStatus());

// game.shuffle();
// logger(game.status());

