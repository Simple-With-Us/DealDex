import test from 'node:test';
import assert from 'node:assert/strict';
import {nextSharedBuild as next} from './shared-build.mjs';
// The stamp is set explicitly so every case is deterministic.
const STAMP = '202610290930';
const input = {iosBuilds: [], macBuilds: [], complete: true, mergeStamp: STAMP};
test('fresh app plans the merge stamp itself', () => {
  assert.deepEqual(next(input), {build: STAMP});
  assert.deepEqual(next({...input, extraFloors: [0]}), {build: STAMP});
});
test('existing builds below the stamp still plan the stamp', () => {
  assert.deepEqual(next({...input, iosBuilds: ['1000']}), {build: STAMP});
  assert.deepEqual(next({...input, iosBuilds: ['0.1.3', '1.1.2']}), {build: STAMP});
  assert.deepEqual(next({...input, iosBuilds: ['101'], macBuilds: ['202610190645']}), {build: STAMP});
  assert.deepEqual(next({...input, extraFloors: [1500]}), {build: STAMP});
});
test('an existing build at or above the stamp plans one higher', () => {
  assert.deepEqual(next({...input, iosBuilds: ['209912312359']}), {build: '209912312360'});
  // A rebuild of the same commit still goes up:  the previous ship holds M.
  assert.deepEqual(next({...input, iosBuilds: [STAMP]}), {build: '202610290931'});
  assert.deepEqual(next({...input, iosBuilds: [`${STAMP}.1`]}), {build: '202610290931'});
});
test('iOS timestamp builds count now', () => {
  assert.deepEqual(next({...input, iosBuilds: ['202610190645', '202610180127']}), {build: STAMP});
  assert.deepEqual(
    next({...input, iosBuilds: ['202610190645', '202610300900']}),
    {build: '202610300901'}
  );
});
test('the max is shared across iOS and macOS', () => {
  assert.deepEqual(
    next({...input, iosBuilds: ['202610300900'], macBuilds: ['202610290931']}),
    {build: '202610300901'}
  );
  assert.deepEqual(next({...input, macBuilds: ['202610300900']}), {build: '202610300901'});
});
test('extra floors join the same max with no cap', () => {
  assert.deepEqual(next({...input, extraFloors: [986]}), {build: STAMP});
  assert.deepEqual(next({...input, extraFloors: [202610300900]}), {build: '202610300901'});
  assert.deepEqual(
    next({...input, iosBuilds: ['202610290931'], extraFloors: [202610300900]}),
    {build: '202610300901'}
  );
  assert.deepEqual(next({...input, extraFloors: ['999999999999999999']}), {build: '1000000000000000000'});
  assert.deepEqual(next({...input, iosBuilds: ['999999999999999999']}), {build: '1000000000000000000'});
});
test('malformed inventory throws before computing', () => {
  for (const bad of [null, 'NaN', '1.2.3.4', 42, '', ' 1000', 'v1']) {
    assert.throws(() => next({...input, iosBuilds: [bad]}), /malformed build inventory/);
    assert.throws(() => next({...input, macBuilds: [bad]}), /malformed build inventory/);
  }
  for (const bad of [-1, 1.5, NaN, '-5', '1.5', null, '']) {
    assert.throws(() => next({...input, extraFloors: [bad]}), /malformed build inventory/);
  }
  // A malformed entry is reported even when the max is already above the stamp.
  assert.throws(() => next({...input, iosBuilds: ['209912312359', 'NaN']}), /malformed build inventory/);
});
test('bad merge stamp throws before computing', () => {
  for (const bad of [undefined, null, 202610290930, '', '099912312359', '20261029093', '2026102909300', '2026-10-29', '20261029abcd']) {
    assert.throws(() => next({...input, mergeStamp: bad}), /malformed merge stamp/);
  }
});
test('incomplete inventory refuses', () => {
  assert.throws(() => next({...input, complete: false}), /complete build inventory required/);
  assert.throws(() => next({...input, complete: undefined}), /complete build inventory required/);
  assert.throws(() => next({iosBuilds: [], complete: true, mergeStamp: STAMP}), /complete build inventory required/);
  assert.throws(() => next({macBuilds: [], complete: true, mergeStamp: STAMP}), /complete build inventory required/);
  assert.throws(() => next({iosBuilds: '1000', macBuilds: [], complete: true, mergeStamp: STAMP}), /complete build inventory required/);
});
