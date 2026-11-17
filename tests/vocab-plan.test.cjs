require('./register-test-ts.cjs');
process.env.TZ = 'Asia/Bangkok';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const plan = require('../lib/vocab/plan.ts');

const entry = (n, words) => ({
  id: `e${n}`, book_id: 'b', order_index: n, kanji: `K${n}`, related: null, han_viet: null,
  meaning: 'm', structure: null, mnemonic: null, readings: [],
  vocabulary: Array.from({ length: words }, (_, i) => ({ word: `w${n}-${i}`, reading: `r${n}-${i}`, meaning: 'x' })),
  created_at: '',
});

test('days are cut by word count without splitting an entry', () => {
  const entries = [entry(1, 3), entry(2, 3), entry(3, 6), entry(4, 1), entry(5, 2), entry(6, 4)];
  const days = plan.splitIntoDays(entries, false, 6);
  assert.deepEqual(days.map((day) => day.map((e) => e.order_index)), [[1, 2], [3], [4, 5, 6]]);
  assert.equal(days.flat().length, entries.length);
});

test('schedule inserts a review day after every six learning days', () => {
  const entries = Array.from({ length: 14 }, (_, i) => entry(i + 1, 2));
  const items = plan.buildSchedule(entries, false, 2);
  assert.deepEqual(items.map((item) => item.kind[0]).join(''), 'llllllrllllllrllr');
  const firstReview = items[6];
  assert.equal(firstReview.week, 1);
  assert.equal(firstReview.entryIds.length, 6);
  assert.deepEqual(items.map((item) => item.index), items.map((_, i) => i));
});

test('SRS climbs only on due answers and a lapse keeps the word learned', () => {
  const t0 = new Date('2026-10-20T08:00:00Z');
  let w = plan.reviewWord(undefined, true, t0);
  assert.equal(w.interval_days, 1);
  // Re-drilled the same day: no promotion.
  assert.equal(plan.reviewWord(w, true, t0).interval_days, 1);
  const t1 = new Date(t0.getTime() + 86400000);
  w = plan.reviewWord(w, true, t1);
  assert.equal(w.interval_days, 3);
  const later = (days) => new Date(t0.getTime() + days * 86400000);
  w = plan.reviewWord(w, true, later(4));
  w = plan.reviewWord(w, true, later(11));
  w = plan.reviewWord(w, true, later(25));
  assert.equal(w.interval_days, 30);
  assert.equal(w.mastered, true);
  w = plan.reviewWord(w, false, later(55));
  assert.equal(w.interval_days, 1);
  assert.equal(plan.isPassed(w), true);
  assert.equal(plan.reviewWord(undefined, false, t0).interval_days, 0);
});

test('progress reports the first open day and how far behind the calendar it is', () => {
  const entries = Array.from({ length: 8 }, (_, i) => entry(i + 1, 1));
  const items = plan.buildSchedule(entries, false, 1);
  const reviews = new Map();
  for (const e of entries.slice(0, 2)) reviews.set(`w${e.order_index}-0|r${e.order_index}-0`, { interval_days: 1, correct_streak: 1, mastered: false, next_review_at: null });
  const progress = plan.planProgress({
    plan: { start_date: '2026-10-15', reviews_done: [] },
    items, entries, phraseBook: false, reviews, learnedEntries: new Map(), today: '2026-10-20',
  });
  assert.equal(progress.currentIndex, 2);
  assert.equal(progress.scheduledIndex, 5);
  assert.equal(progress.behind, 3);
  assert.equal(plan.startDateFor(progress.currentIndex, '2026-10-20'), '2026-10-18');
});

test('re-pacing skips reviews of weeks that are already fully learned', () => {
  const entries = Array.from({ length: 12 }, (_, i) => entry(i + 1, 1));
  const items = plan.buildSchedule(entries, false, 1);
  const done = items.map((item, index) => index < 6);
  assert.deepEqual(plan.reviewedWeeksAfterRepace(items, done), [1]);
});
