require('./register-test-ts.cjs');
process.env.TZ = 'Asia/Bangkok';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { scoreAttempt } = require('../lib/scoring/index.ts');
const { normalizeJa, moraTokens, scorePronunciationDetailed } = require('../lib/scoring/pronunciation.ts');
const { scoreSpeed, speedDelta } = require('../lib/scoring/speed.ts');
const { scoreIntonation } = require('../lib/scoring/intonation.ts');
const { toReading } = require('../lib/scoring/kana.ts');
const { analyzeSignal } = require('../lib/speech/quality.ts');
const { contourMetrics } = require('../lib/speech/pitch.ts');
const { applyAttempt } = require('../lib/store/engine.ts');
const { emptyState } = require('../lib/store/state.ts');
const { POST } = require('../app/api/score/route.ts');
const audioEvidence = {duration:3,activeSeconds:2,clippedFraction:0,voicedSeconds:1};
const req = {targetText:'私は学生です。',spokenText:'わたしはがくせいです',targetReading:'ワタシワガクセイデス',spokenReading:'ワタシワガクセイデス',audioEvidence};

test('no fabricated speed; invalid numbers are unmeasured', () => {
  for (const value of [null,0,-1,NaN,Infinity]) assert.equal(scoreSpeed({originalDurationSeconds:value,userDurationSeconds:2}),null);
  assert.equal(scoreSpeed({originalDurationSeconds:2,userDurationSeconds:2}),100);
  assert.equal(speedDelta(4,2),100);
  assert.equal(speedDelta(2,4),-50);
  assert.equal(scoreIntonation({similarity:Infinity}),null);
});
test('normalization preserves meaningful mora distinctions', () => {
  assert.equal(normalizeJa('ｶﾞｯｺｳ！'),normalizeJa('がっこう'));
  assert.equal(normalizeJa('か\u3099'),normalizeJa('ガ'));
  assert.deepEqual(moraTokens('きゃっとー'),['キャ','ッ','ト','ー']);
  assert.notEqual(normalizeJa('ビル'),normalizeJa('ビール'));
  assert.notEqual(normalizeJa('きて'),normalizeJa('きって'));
});
test('missing or unusable evidence never creates a score', () => {
  for (const extra of [{spokenText:''},{audioEvidence:null},{audioEvidence:{...audioEvidence,activeSeconds:0}},{audioEvidence:{...audioEvidence,clippedFraction:0.5}},{targetReading:null},{targetReading:'123人'}]) {
    assert.throws(()=>scoreAttempt({...req,...extra}));
  }
});
test('measured content can pass with explicitly absent optional dimensions', () => {
  const s=scoreAttempt(req); assert.equal(s.total,100); assert.equal(s.passed,true);
  assert.equal(s.speed,null); assert.equal(s.intonation,null); assert.equal(s.confidence,'limited');
});
test('omission, repetition, reordering, unrelated content cannot pass', () => {
  for(const text of ['ワタシ','ワタシワガクセイデスワタシワガクセイデス','ガクセイデスワタシワ','アシタアメデス']) {
    const s=scoreAttempt({...req,spokenText:text,spokenReading:text}); assert.equal(s.passed,false,text);
  }
});
test('alignment exposes missing, extra and substituted units', () => {
  assert.ok(scorePronunciationDetailed({targetText:'カキク',spokenText:'カク'}).alignment.some(a=>a.status==='missing'));
  assert.ok(scorePronunciationDetailed({targetText:'カク',spokenText:'カキク'}).alignment.some(a=>a.status==='extra'));
  assert.ok(scorePronunciationDetailed({targetText:'カキ',spokenText:'カク'}).alignment.some(a=>a.status==='substitution'));
});
test('real tokenizer handles kanji/kana and particle readings', async () => {
  assert.equal(await toReading('私は学生です'),await toReading('わたしはがくせいです'));
  assert.equal(await toReading('学校へ行く'),await toReading('がっこうへいく'));
});
test('synthetic signal checks: silence, quiet, clipping, pauses; no accuracy claim', () => {
  assert.equal(analyzeSignal(new Float32Array(16000),16000).activeSeconds,0);
  assert.equal(analyzeSignal(new Float32Array(16000).fill(0.001),16000).activeSeconds,0);
  assert.equal(analyzeSignal(new Float32Array(16000).fill(1),16000).clippedFraction,1);
  assert.equal(contourMetrics([0,0,0],[100,120,150]),null);
  assert.equal(contourMetrics([110,120,140],[100,100,100]),null);
});
test('API validates JSON/types/limits and rejects unscorable requests', async () => {
  for(const body of [{targetText:'a',spokenText:{}},{targetText:'x'.repeat(1001)},{targetText:'a',passScore:101}]) {
    assert.equal((await POST(new Request('http://local/api/score',{method:'POST',body:JSON.stringify(body)}))).status,400);
  }
  const response=await POST(new Request('http://local/api/score',{method:'POST',body:JSON.stringify({targetText:'こんにちは'})}));
  assert.equal(response.status,422); assert.equal((await response.json()).error,'no_transcript');
});
test('same attempt replay and same local-day repeat do not pay XP twice', () => {
  const now=new Date(); now.setHours(0,30,0,0); const iso=now.toISOString();
  const state=emptyState(iso);
  state.lessons=[{id:'lesson',user_id:'u',title:'Test',is_public:true}];
  state.sentences=[{id:'sentence',lesson_id:'lesson',ja_text:req.targetText,order_index:0,pass_score:80}];
  state.profile={id:'u',email:'test@example.invalid',display_name:'Test',avatar_url:null,total_xp:0,current_level:1,current_streak:0,longest_streak:0,last_completed_date:null,created_at:iso};
  const input={attemptId:'same',sentenceId:state.sentences[0].id,score:scoreAttempt(req),transcript:req.spokenText,recordingUrl:null,userDurationSeconds:3};
  const first=applyAttempt(state,input,iso);
  const duplicate=applyAttempt(first.state,input,iso);
  assert.equal(duplicate.state,first.state); assert.equal(duplicate.outcome.xpGained,0);
  const repeat=applyAttempt(first.state,{...input,attemptId:'new'},iso);
  assert.equal(repeat.outcome.xpGained,0); assert.equal(repeat.outcome.countedToday,false);
  assert.equal(first.state.attempts[0].speed_score,null);
});
