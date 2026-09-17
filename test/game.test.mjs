/**
Copyright (c) 2022-2026 Hidenori ISHIKAWA. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createGame } from '../game.mjs';

// shuffles を 0 にすると山札の並びが決定的になるので、
// 「どの札がどこへ動いたか」まで固定できる。並びは
// スート クラブ,ダイヤ,ハート,スペード の順に、各 13 枚が 10,2..9,A,J,Q,K の順
// （なぜ 10 が先頭かは「未シャッフルの並びは…」のテストを参照）。
function plainGame(players, setup) {
	return createGame(players ?? [ 'p1', 'p2' ], setup ?? tarot(), 1, 0, 0, 0);
}

// createGame に渡す卓の設定（setup）を作る。
function tarot(...tarots) {
	return { mode: 'tarot', tarots: tarots };
}

function epitaph(...epitaphs) {
	return { mode: 'epitaph', epitaphs: epitaphs };
}

const NONE = { mode: 'none' };

const MASTER = 0;

// Cards は Array のサブクラスなので、deepStrictEqual に渡す前に素の配列へ均す。
function names(cards) {
	return [ ...cards.names() ];
}

describe('createGame', () => {
	it('マスターを先頭に足して席を作る', () => {
		const game = plainGame([ 'p1', 'p2' ]);
		assert.deepEqual(game.getAllPlayers(), [ 'マスター', 'p1', 'p2' ]);
		assert.equal(game.getPlayer(MASTER), 'マスター');
		assert.equal(game.getPlayer(2), 'p2');
	});

	it('pid が文字列でも席を引ける', () => {
		// app.mjs は req.params.pid を文字列のまま渡す。
		const game = plainGame();
		assert.equal(game.getPlayer('1'), 'p1');
		assert.equal(game.getHandOfPlayer('1').toJson().length, 0);
	});

	it('山札は decks × 52 ＋ jokers', () => {
		assert.equal(plainGame().getDeck().toJson().length, 52);
		assert.equal(createGame([ 'p1' ], tarot(), 2, 2, 0, 0).getDeck().toJson().length, 106);
	});

	it('draws の枚数だけ全員に配り、その分だけ山札が減る', () => {
		const game = createGame([ 'p1', 'p2' ], tarot(), 1, 0, 0, 4);
		assert.equal(game.getDeck().toJson().length, 52 - 3 * 4);
		for (const pid of [ 0, 1, 2 ]) {
			assert.equal(game.getHandOfPlayer(pid).toJson().length, 4);
		}
	});

	it('未シャッフルの並びは 10,2..9,A,J,Q,K の順になる', () => {
		// attr.js の ranks は素のオブジェクトリテラルで、'0'(=10) と '2'..'9' が
		// 整数キーとして扱われる。JS のプロパティ順は整数キーが昇順で先に来るので、
		// 'A' より '0' が前に出る。実戦ではシャッフルされるので影響しないが、
		// 決定的なテストを書くときはこの並びが前提になる。
		const game = createGame([], tarot(), 1, 0, 0, 13);
		assert.deepEqual(names(game.getHandOfPlayer(MASTER).toJson().cards), [
			'クラブ 10 (0)', 'クラブ 2 (0)', 'クラブ 3 (0)', 'クラブ 4 (0)',
			'クラブ 5 (0)', 'クラブ 6 (0)', 'クラブ 7 (0)', 'クラブ 8 (0)',
			'クラブ 9 (0)', 'クラブ エース (0)', 'クラブ ジャック (0)',
			'クラブ クイーン (0)', 'クラブ キング (0)',
		]);
	});

	it('スートは クラブ,ダイヤ,ハート,スペード の順', () => {
		const game = createGame([], tarot(), 1, 0, 0, 14);
		assert.equal(game.getHandOfPlayer(MASTER).at(13).name(), 'ダイヤ 10 (0)');
	});

	it('配る順は席順で、山札の先頭から取る', () => {
		const game = createGame([ 'p1' ], tarot(), 1, 0, 0, 2);
		assert.deepEqual(names(game.getHandOfPlayer(MASTER).toJson().cards),
			[ 'クラブ 10 (0)', 'クラブ 2 (0)' ]);
		assert.deepEqual(names(game.getHandOfPlayer(1).toJson().cards),
			[ 'クラブ 3 (0)', 'クラブ 4 (0)' ]);
	});

	it('山札が尽きたら配れるところまでで止める', () => {
		// createHandCards() にガードが無いと undefined が手札に混ざる。
		const game = createGame([ 'p1' ], tarot(), 1, 0, 0, 30);

		assert.equal(game.getDeck().toJson().length, 0);
		assert.equal(game.getHandOfPlayer(MASTER).toJson().length, 30);
		assert.equal(game.getHandOfPlayer(1).toJson().length, 22);
		for (const pid of [ 0, 1 ]) {
			const cards = game.getHandOfPlayer(pid).toJson().cards;
			assert.equal(cards.filter((card) => undefined === card).length, 0);
		}
	});

	it('山札が空の席は手札 0 枚になる', () => {
		const game = createGame([ 'p1', 'p2' ], tarot(), 1, 0, 0, 52);

		assert.equal(game.getHandOfPlayer(MASTER).toJson().length, 52);
		assert.equal(game.getHandOfPlayer(1).toJson().length, 0);
		assert.equal(game.getHandOfPlayer(2).toJson().length, 0);
	});

	it('捨て札は空で始まる', () => {
		assert.deepEqual(plainGame().getPile().toJson(), { length: 0, card: undefined });
	});

	it('既定値は decks=2 jokers=2 shuffles=10 draws=4', () => {
		const game = createGame([ 'p1', 'p2' ], tarot());
		assert.equal(game.getDeck().toJson().length, 2 * 52 + 2 - 3 * 4);
		assert.equal(game.getHandOfPlayer(MASTER).toJson().length, 4);
	});

	it('tarots を省略してもタロットは使う（誰にも配らないだけ）', () => {
		const game = createGame([ 'p1', 'p2' ], { mode: 'tarot' });
		assert.equal(game.getMode(), 'tarot');
		assert.equal(game.getTarotDeck().toJson().length, 28);
	});
});

describe('卓の設定（setup）', () => {
	it('mode で卓の種類が決まる', () => {
		assert.equal(plainGame([ 'p1' ], tarot()).getMode(), 'tarot');
		assert.equal(plainGame([ 'p1' ], NONE).getMode(), 'none');
		assert.equal(plainGame([ 'p1' ], epitaph()).getMode(), 'epitaph');
	});

	it('mode が無い・知らない値なら投げる', () => {
		// 以前の形（配列、false、{ epitaphs }）からも種類を推し量らない。
		for (const setup of [ undefined, null, {}, { mode: 'poker' }, [], [ '4' ], false, { epitaphs: [] } ]) {
			assert.throws(() => createGame([ 'p1' ], setup), TypeError, JSON.stringify(setup));
		}
	});

	it('mode に合わない札の指定は使わない', () => {
		const cards = { tarots: [ '4' ], epitaphs: [ '1' ] };
		const none = createGame([ 'p1' ], { mode: 'none', ...cards }, 1, 0, 0, 0);
		const epitaphs = createGame([ 'p1' ], { mode: 'epitaph', ...cards }, 1, 0, 0, 0);
		const tarots = createGame([ 'p1' ], { mode: 'tarot', ...cards }, 1, 0, 0, 0);

		assert.equal(none.getTarotDeck().toJson().length, 0);
		assert.equal(none.getTarotHandOfPlayer(1).toJson().length, 0);
		assert.deepEqual(none.getEpitaphs().ranks(), []);
		assert.equal(epitaphs.getTarotHandOfPlayer(1).toJson().length, 0);
		assert.deepEqual(epitaphs.getEpitaphs().ranks(), [ '1' ]);
		assert.equal(tarots.getTarotHandOfPlayer(1).toJson().card.rank, '4');
		assert.deepEqual(tarots.getEpitaphs().ranks(), []);
	});
});

describe('タロット', () => {
	it('配った切り札はタロット山札から除かれる', () => {
		// tarotRanks は 28 種。指定した 2 種が山札から抜ける。
		const game = plainGame([ 'p1', 'p2' ], tarot('4', '18'));
		assert.equal(game.getTarotDeck().toJson().length, 26);
	});

	it('切り札は players の並び順に配られ、マスターは持たない', () => {
		const game = plainGame([ 'p1', 'p2' ], tarot('4', '18'));
		assert.deepEqual(game.getTarotHandOfPlayer(MASTER).toJson(),
			{ length: 0, card: undefined });
		assert.equal(game.getTarotHandOfPlayer(1).toJson().card.rank, '4');
		assert.equal(game.getTarotHandOfPlayer(2).toJson().card.rank, '18');
	});

	it('未知の rank を指定した席は切り札なしになる', () => {
		const game = plainGame([ 'p1' ], tarot('このrankは無い'));
		assert.equal(game.getTarotHandOfPlayer(1).toJson().length, 0);
		assert.equal(game.getTarotDeck().toJson().length, 28);
	});

	it('切り札は既定で正位置', () => {
		const game = plainGame([ 'p1' ], tarot('4'));
		const card = game.getTarotHandOfPlayer(1).toJson().card;
		assert.equal(card.position, 'U');
		assert.equal(card.name(), 'カブト 正位置');
	});

	it('TarotPile.flip() は正逆を入れ替える', () => {
		const game = plainGame([ 'p1' ], tarot('4'));
		game.getTarotHandOfPlayer(1).discard(0);
		const pile = game.getTarotPile();

		assert.equal(pile.toJson().card.position, 'U');
		pile.flip();
		assert.equal(pile.toJson().card.position, 'R');
		assert.equal(pile.toJson().card.name(), 'カブト 逆位置');
		pile.flip();
		assert.equal(pile.toJson().card.position, 'U');
	});

	it('TarotPile.flip() は捨て札が空でも落ちない', () => {
		const game = plainGame();
		assert.doesNotThrow(() => game.getTarotPile().flip());
	});

	it('TarotHand.toJson() は cards ではなく card を返す', () => {
		const json = plainGame([ 'p1' ], tarot('4')).getTarotHandOfPlayer(1).toJson();
		assert.deepEqual(Object.keys(json), [ 'length', 'card' ]);
	});
});

describe('タロットを使わない卓', () => {
	it('タロット山札・捨て札・切り札を空で作る', () => {
		// 画面で隠すだけでなく札そのものを作らない。API を直に叩いても出てこない。
		const game = plainGame([ 'p1', 'p2' ], NONE);

		assert.equal(game.getTarotDeck().toJson().length, 0);
		assert.deepEqual(game.getTarotPile().toJson(), { length: 0, card: undefined });
		for (const pid of [ MASTER, 1, 2 ]) {
			assert.equal(game.getTarotHandOfPlayer(pid).toJson().length, 0);
		}
	});

	it('タロットの操作をしても何も起きない', () => {
		const game = plainGame([ 'p1' ], NONE);

		game.getTarotDeck().discard(0);
		game.getTarotHandOfPlayer(1).discard(0);
		game.getTarotPile().flip();
		game.getTarotPile().shuffle();

		assert.equal(game.getTarotDeck().toJson().length, 0);
		assert.equal(game.getTarotPile().toJson().length, 0);
	});

	it('トランプは使う卓と同じに配る', () => {
		const game = plainGame([ 'p1', 'p2' ], NONE);
		assert.equal(game.getDeck().toJson().length, 52);
		assert.equal(createGame([ 'p1', 'p2' ], NONE, 1, 0, 0, 4).getDeck().toJson().length,
			52 - 3 * 4);
	});

	it('卓の公開状態と dump に mode が載る', () => {
		const game = plainGame([ 'p1' ], NONE);
		const table = game.getTable().toJson();

		assert.equal(table.mode, 'none');
		assert.equal(table.tarotDeck.length, 0);
		assert.deepEqual(table.seats.map((seat) => seat.tarot.length), [ 0, 0 ]);
		assert.deepEqual(table.epitaphs, []);
		assert.equal(game.toJson().mode, 'none');
	});
});

describe('エピタフの卓', () => {
	function epitaphGame(epitaphs) {
		return plainGame([ 'p1', 'p2' ], epitaph(...epitaphs));
	}

	it('表の番号順に、すべて裏で並べる（シャッフルしない）', () => {
		const game = epitaphGame([ '24', '1', '12' ]);

		assert.equal(game.getMode(), 'epitaph');
		assert.deepEqual(game.getEpitaphs().ranks(), [ '1', '12', '24' ]);
		assert.deepEqual([ ...game.toJson().epitaphs ],
			[ 'ルシファー 裏', 'トリガー 裏', 'ホムラ 裏' ]);
	});

	it('0 枚でも作れる', () => {
		const game = epitaphGame([]);

		assert.equal(game.getMode(), 'epitaph');
		assert.deepEqual(game.getTable().toJson().epitaphs, []);
	});

	it('知らない番号と重複は並べない', () => {
		// API で弾くが、モデル単体でも崩れないこと。
		assert.deepEqual(epitaphGame([ '1', '1', '32', '0' ]).getEpitaphs().ranks(), [ '1' ]);
	});

	it('タロットは使わない', () => {
		const game = epitaphGame([ '1' ]);

		assert.equal(game.getTarotDeck().toJson().length, 0);
		for (const pid of [ MASTER, 1, 2 ]) {
			assert.equal(game.getTarotHandOfPlayer(pid).toJson().length, 0);
		}
	});

	it('卓の公開状態には裏の札の番号を出さない', () => {
		const table = epitaphGame([ '1', '12' ]).getTable().toJson();

		assert.deepEqual(table.epitaphs, [ { open: false }, { open: false } ]);
		assert.equal(JSON.stringify(table).includes('rank'), false);
	});

	it('マスターの見え方では裏の札も番号つき', () => {
		const epitaphs = epitaphGame([ '1', '12' ]).getEpitaphs();

		assert.deepEqual(epitaphs.toJson(true), [
			{ open: false, rank: '1' },
			{ open: false, rank: '12' },
		]);
	});

	it('表にした札だけ番号が出て、裏に戻すとまた隠れる', () => {
		const game = epitaphGame([ '1', '12', '24' ]);
		const epitaphs = game.getEpitaphs();

		epitaphs.open(1);
		assert.deepEqual(game.getTable().toJson().epitaphs,
			[ { open: false }, { open: true, rank: '12' }, { open: false } ]);
		assert.equal(game.toJson().epitaphs[1], 'トリガー 表');

		epitaphs.close(1);
		assert.deepEqual(game.getTable().toJson().epitaphs,
			[ { open: false }, { open: false }, { open: false } ]);
	});

	it('並びの外は undefined', () => {
		assert.equal(epitaphGame([ '1' ]).getEpitaphs().at(1), undefined);
	});
});

describe('Deck', () => {
	it('discard() は山札から抜いて捨て札の先頭へ積む', () => {
		const game = plainGame();
		const deck = game.getDeck();
		const pile = game.getPile();

		deck.discard(0);
		assert.equal(deck.toJson().length, 51);
		assert.equal(pile.toJson().length, 1);
		assert.equal(pile.toJson().card.name(), 'クラブ 10 (0)');

		deck.discard(0);
		// 後から捨てた方が先頭に来る。
		assert.equal(pile.toJson().card.name(), 'クラブ 2 (0)');
		assert.equal(pile.toJson().length, 2);
	});

	it('discard() は範囲外の index では何もしない', () => {
		const game = plainGame();
		const deck = game.getDeck();

		deck.discard(999);
		assert.equal(deck.toJson().length, 52);
		assert.equal(game.getPile().toJson().length, 0);
	});

	it('recycle() は捨て札の先頭を山札の先頭へ戻す', () => {
		const game = plainGame();
		const deck = game.getDeck();

		deck.discard(0);
		deck.discard(0);
		deck.recycle();

		assert.equal(deck.toJson().length, 51);
		assert.equal(game.getPile().toJson().card.name(), 'クラブ 10 (0)');
		// 末尾ではなく先頭に戻るので、次に引くのは戻した札。
		const hand = game.getHandOfPlayer(MASTER);
		hand.draw();
		assert.equal(hand.at(0).name(), 'クラブ 2 (0)');
	});

	it('recycle() は捨て札が空なら何もしない', () => {
		const game = plainGame();
		const deck = game.getDeck();

		deck.recycle();
		assert.equal(deck.toJson().length, 52);
	});
});

describe('Pile', () => {
	it('shuffle() は捨て札を全て山札へ戻す', () => {
		const game = plainGame();
		const deck = game.getDeck();
		const pile = game.getPile();

		deck.discard(0);
		deck.discard(0);
		deck.discard(0);
		assert.equal(pile.toJson().length, 3);

		pile.shuffle();
		assert.equal(pile.toJson().length, 0);
		assert.equal(deck.toJson().length, 52);
	});

	it('shuffle() は札を失わない', () => {
		const game = createGame([ 'p1' ], tarot(), 1, 0, 0, 0);
		const deck = game.getDeck();
		const before = new Set(game.toJson().deck);

		for (let i = 0; i < 10; i++) {
			deck.discard(0);
		}
		game.getPile().shuffle();

		assert.deepEqual(new Set(game.toJson().deck), before);
	});

	it('toJson() の card は一番上の 1 枚だけ', () => {
		const game = plainGame();
		game.getDeck().discard(0);
		const json = game.getPile().toJson();

		assert.deepEqual(Object.keys(json), [ 'length', 'card' ]);
		assert.equal(json.length, 1);
	});
});

describe('Hand', () => {
	it('draw() は山札の先頭を手札の末尾へ', () => {
		const game = plainGame();
		const hand = game.getHandOfPlayer(1);

		hand.draw();
		hand.draw();
		assert.deepEqual(names(hand.toJson().cards),
			[ 'クラブ 10 (0)', 'クラブ 2 (0)' ]);
		assert.equal(game.getDeck().toJson().length, 50);
	});

	it('draw() は山札が空なら何もしない', () => {
		const game = createGame([ 'p1' ], tarot(), 1, 0, 0, 26);
		const hand = game.getHandOfPlayer(1);
		assert.equal(game.getDeck().toJson().length, 0);

		hand.draw();
		assert.equal(hand.toJson().length, 26);
	});

	it('discard() は手札から抜いて捨て札の先頭へ', () => {
		const game = createGame([ 'p1' ], tarot(), 1, 0, 0, 3);
		const hand = game.getHandOfPlayer(1);

		hand.discard(1);
		assert.deepEqual(names(hand.toJson().cards),
			[ 'クラブ 4 (0)', 'クラブ 6 (0)' ]);
		assert.equal(game.getPile().toJson().card.name(), 'クラブ 5 (0)');
	});

	it('discard() は範囲外の index では何もしない', () => {
		const game = createGame([ 'p1' ], tarot(), 1, 0, 0, 3);
		const hand = game.getHandOfPlayer(1);

		hand.discard(999);
		assert.equal(hand.toJson().length, 3);
		assert.equal(game.getPile().toJson().length, 0);
	});

	it('recycle() は捨て札の先頭を手札の末尾へ', () => {
		const game = createGame([ 'p1' ], tarot(), 1, 0, 0, 2);
		const hand = game.getHandOfPlayer(1);

		hand.discard(0);
		hand.recycle();
		assert.deepEqual(names(hand.toJson().cards),
			[ 'クラブ 4 (0)', 'クラブ 3 (0)' ]);
		assert.equal(game.getPile().toJson().length, 0);
	});

	it('passTo() は相手の手札の末尾へ渡す', () => {
		const game = createGame([ 'p1', 'p2' ], tarot(), 1, 0, 0, 2);
		const from = game.getHandOfPlayer(1);
		const to = game.getHandOfPlayer(2);

		from.passTo(0, 2);
		assert.equal(from.toJson().length, 1);
		assert.equal(to.toJson().length, 3);
		assert.equal(to.at(2).name(), 'クラブ 3 (0)');
	});

	it('passTo() は範囲外の index では何もしない', () => {
		const game = createGame([ 'p1', 'p2' ], tarot(), 1, 0, 0, 2);
		const from = game.getHandOfPlayer(1);

		from.passTo(999, 2);
		assert.equal(from.toJson().length, 2);
		assert.equal(game.getHandOfPlayer(2).toJson().length, 2);
	});

	it('pickFrom() は相手から 1 枚抜いて自分の末尾へ', () => {
		const game = createGame([ 'p1', 'p2' ], tarot(), 1, 0, 0, 2);
		const mine = game.getHandOfPlayer(1);
		const theirs = game.getHandOfPlayer(2);
		const candidates = theirs.toJson().cards.names();

		mine.pickFrom(2);
		assert.equal(mine.toJson().length, 3);
		assert.equal(theirs.toJson().length, 1);
		// どの 1 枚かは乱数で決まるので、相手が持っていた札のいずれかであること。
		assert.ok(candidates.includes(mine.at(2).name()));
	});

	it('pickFrom() は相手の手札が空なら何もしない', () => {
		const game = createGame([ 'p1', 'p2' ], tarot(), 1, 0, 0, 0);
		const mine = game.getHandOfPlayer(1);

		mine.pickFrom(2);
		assert.equal(mine.toJson().length, 0);
	});

	it('at() は手札の 1 枚を返し、範囲外は undefined', () => {
		const game = createGame([ 'p1' ], tarot(), 1, 0, 0, 1);
		const hand = game.getHandOfPlayer(1);

		assert.equal(hand.at(0).name(), 'クラブ 2 (0)');
		assert.equal(hand.at(1), undefined);
	});

	it('at() は文字列の index でも引ける', () => {
		// app.mjs は req.params.cid を文字列のまま渡す。
		const game = createGame([ 'p1' ], tarot(), 1, 0, 0, 2);
		assert.equal(game.getHandOfPlayer(1).at('1').name(), 'クラブ 4 (0)');
	});
});

describe('Table', () => {
	it('全席と場の枚数を 1 つにまとめる', () => {
		const game = createGame([ 'p1', 'p2' ], tarot('4', '18'), 1, 0, 0, 3);
		const json = game.getTable().toJson();

		assert.deepEqual(Object.keys(json),
			[ 'mode', 'seats', 'deck', 'pile', 'tarotDeck', 'tarotPile', 'epitaphs' ]);
		assert.equal(json.mode, 'tarot');
		assert.deepEqual(json.epitaphs, []);
		assert.equal(json.deck.length, 52 - 3 * 3);
		assert.deepEqual(json.pile, { length: 0, card: undefined });
		assert.equal(json.tarotDeck.length, 26);
		assert.deepEqual(json.tarotPile, { length: 0, card: undefined });
	});

	it('席は pid・名前・手札の枚数・切り札の有無', () => {
		const game = createGame([ 'p1', 'p2' ], tarot('4', '18'), 1, 0, 0, 3);

		assert.deepEqual(game.getTable().toJson().seats, [
			{ pid: '0', player: 'マスター', hand: { length: 3 }, tarot: { length: 0 } },
			{ pid: '1', player: 'p1', hand: { length: 3 }, tarot: { length: 1 } },
			{ pid: '2', player: 'p2', hand: { length: 3 }, tarot: { length: 1 } },
		]);
	});

	it('手札の中身を出さない', () => {
		// 表示側で隠すだけだと DevTools から読めるので、ここで止める。
		const game = createGame([ 'p1' ], tarot('4'), 1, 0, 0, 3);
		const json = JSON.stringify(game.getTable().toJson());

		assert.equal(json.includes('suit'), false);
		assert.equal(json.includes('rank'), false);
		for (const seat of game.getTable().toJson().seats) {
			assert.deepEqual(Object.keys(seat.hand), [ 'length' ]);
			assert.deepEqual(Object.keys(seat.tarot), [ 'length' ]);
		}
	});

	it('捨て札の一番上だけは表で出す', () => {
		const game = createGame([ 'p1' ], tarot(), 1, 0, 0, 0);
		game.getDeck().discard(0);
		const pile = game.getTable().toJson().pile;

		assert.equal(pile.length, 1);
		assert.equal(pile.card.name(), 'クラブ 10 (0)');
	});

	it('タロット捨て札の一番上も表で出す', () => {
		const game = createGame([ 'p1' ], tarot('4'), 1, 0, 0, 0);
		game.getTarotHandOfPlayer(1).discard(0);
		const json = game.getTable().toJson();

		assert.equal(json.tarotPile.card.name(), 'カブト 正位置');
		assert.equal(json.seats[1].tarot.length, 0);
	});

	it('場が動いたら数字が追随する', () => {
		const game = createGame([ 'p1' ], tarot(), 1, 0, 0, 2);
		const hand = game.getHandOfPlayer(1);

		hand.discard(0);
		hand.draw();
		const json = game.getTable().toJson();

		assert.equal(json.seats[1].hand.length, 2);
		assert.equal(json.pile.length, 1);
		assert.equal(json.deck.length, 52 - 2 * 2 - 1);
	});
});

describe('Game.toJson', () => {
	it('全ての山と席を名前の配列で出す', () => {
		const game = createGame([ 'p1' ], tarot('4'), 1, 0, 0, 1);
		const json = game.toJson();

		assert.deepEqual(Object.keys(json),
			[ 'mode', 'deck', 'pile', 'players', 'tarotDeck', 'tarotPile', 'epitaphs' ]);
		assert.equal(json.deck.length, 50);
		assert.deepEqual([ ...json.pile ], []);
		assert.equal(json.players.length, 2);
		assert.equal(json.players[1].player, 'p1');
		assert.deepEqual([ ...json.players[1].hand ], [ 'クラブ 2 (0)' ]);
		assert.deepEqual([ ...json.players[1].tarotHand ], [ 'カブト 正位置' ]);
		assert.equal(json.tarotDeck.length, 27);
	});
});
