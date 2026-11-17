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
  assert.equal(await toReading('創立100周年'),await toReading('創立百周年'));
  assert.equal(await toReading('２０２６年'),await toReading('二千二十六年'));
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

const { accuracyFromCost, errorTolerance, mismatchCost } = require('../lib/scoring/pronunciation.ts');
const { starsFor } = require('../lib/scoring/stars.ts');
const { utteranceHypotheses } = require('../lib/speech/useRecorder.ts');

test('pass gate scales with sentence length; short sentences only forgive STT-confusable slips', () => {
  // 10-mora sentence: one real slip still reaches the 91 gate, two do not.
  assert.ok(accuracyFromCost(1, 10) >= 91);
  assert.ok(accuracyFromCost(2, 10) < 91);
  // 4-mora word: a dropped ッ is forgiven, a wrong sound is not.
  assert.ok(accuracyFromCost(0.5, 4) >= 91);
  assert.ok(accuracyFromCost(1, 4) < 91);
  assert.equal(accuracyFromCost(0, 7), 100);
  assert.equal(errorTolerance(30), 2.5);
  assert.equal(mismatchCost({target:'ッ',spoken:null,status:'missing'}), 0.5);
  assert.equal(mismatchCost({target:'ー',spoken:'ウ',status:'substitution'}), 0.25);
  assert.equal(mismatchCost({target:'カ',spoken:'ガ',status:'substitution'}), 1);
});
test('dropped sokuon no longer fails a short sentence; tips point at it', () => {
  const s=scoreAttempt({...req,targetText:'きって',spokenText:'きて',targetReading:'キッテ',spokenReading:'キテ'});
  assert.equal(s.passed,true);
  assert.ok(s.tips.some(t=>t.kind==='missing'&&t.target==='ッ'));
  const wrong=scoreAttempt({...req,targetText:'かき',spokenText:'がき',targetReading:'カキ',spokenReading:'ガキ'});
  assert.equal(wrong.passed,false);
});
test('stars: pass, then rhythm, then melody; fallbacks when unmeasured', () => {
  assert.equal(starsFor({passed:false,pronunciation:100,speed:100,intonation:100,total:100}),0);
  assert.equal(starsFor({passed:true,pronunciation:95,speed:80,intonation:50,total:85}),1);
  assert.equal(starsFor({passed:true,pronunciation:95,speed:95,intonation:50,total:88}),2);
  assert.equal(starsFor({passed:true,pronunciation:95,speed:95,intonation:80,total:93}),3);
  assert.equal(starsFor({passed:true,pronunciation:100,speed:null,intonation:null,total:100}),3);
});
test('n-best hypotheses: top first, bounded single swaps', () => {
  assert.deepEqual(utteranceHypotheses([['きて','きって'],['ください']]),['きてください','きってください']);
  assert.ok(utteranceHypotheses(Array.from({length:10},()=>['a','b','c','d','e'])).length<=8);
});
test('API scores every hypothesis and keeps the best one', async () => {
  const res=await POST(new Request('http://local/api/score',{method:'POST',body:JSON.stringify({targetText:'私は学生です',spokenText:'私は先生です',spokenAlternatives:['私は学生です'],audioEvidence})}));
  const body=await res.json();
  assert.equal(res.status,200); assert.equal(body.passed,true); assert.equal(body.chosenTranscript,'私は学生です');
  const bad=await POST(new Request('http://local/api/score',{method:'POST',body:JSON.stringify({targetText:'a',spokenText:'a',spokenAlternatives:[1]})}));
  assert.equal(bad.status,400);
});
test('star upgrades pay once per tier, never twice', () => {
  const now=new Date().toISOString();
  const state=emptyState(now);
  state.lessons=[{id:'lesson',user_id:'u',title:'Test',is_public:true}];
  state.sentences=[{id:'s',lesson_id:'lesson',ja_text:req.targetText,order_index:0,pass_score:80},{id:'s2',lesson_id:'lesson',ja_text:'x',order_index:1,pass_score:80}];
  state.profile={id:'u',email:'t@example.invalid',display_name:'T',avatar_url:null,total_xp:0,current_level:1,current_streak:0,longest_streak:0,last_completed_date:null,created_at:now};
  const base=scoreAttempt(req); // speed/intonation null, perfect → 3 stars
  const one={...base,pronunciation:95,total:90}; // 1 star (fallbacks fail)
  const a=applyAttempt(state,{attemptId:'1',sentenceId:'s',score:one,transcript:'x',recordingUrl:null,userDurationSeconds:2},now);
  assert.equal(a.outcome.starXp,0);
  const b=applyAttempt(a.state,{attemptId:'2',sentenceId:'s',score:base,transcript:'x',recordingUrl:null,userDurationSeconds:2},now);
  assert.equal(b.outcome.stars,3); assert.equal(b.outcome.starXp,6);
  const c=applyAttempt(b.state,{attemptId:'3',sentenceId:'s',score:base,transcript:'x',recordingUrl:null,userDurationSeconds:2},now);
  assert.equal(c.outcome.starXp,0);
});
test('Latin in business sentences: acronyms read by letter, product names are a wildcard slot', async () => {
  const post=(targetText,spokenText)=>POST(new Request('http://local/api/score',{method:'POST',body:JSON.stringify({targetText,spokenText,audioEvidence})})).then(r=>r.json());
  const brand=await post('本日はSuperTransプロジェクトの会議です','本日はスーパートランスプロジェクトの会議です');
  assert.equal(brand.passed,true,JSON.stringify(brand.error));
  const acronym=await post('PMの斎藤です','ピーエムの斎藤です');
  assert.equal(acronym.passed,true);
  const skipped=await post('本日はSuperTransプロジェクトの会議です','本日はプロジェクトの会議です');
  assert.ok(skipped.pronunciation<100);
});

const { scoreLessonRun, lessonRunTotal } = require('../lib/scoring/lesson.ts');
const { POST: POST_LESSON } = require('../app/api/score/lesson/route.ts');
test('full-lesson run is split back per sentence', () => {
  const r=scoreLessonRun(['ハジメマシテ','ワタシワミラーデス','ドウゾヨロシク'],'ハジメマシテワタシワミラーデス');
  assert.deepEqual(r.sentences.map(s=>s.status),['good','good','missed']);
  assert.equal(r.sentences[2].coverage,0);
  assert.ok(r.accuracy<100 && r.accuracy>50);
  const sloppy=scoreLessonRun(['ハジメマシテ','ワタシワミラーデス'],'ハジメマシテワタシワミラデス');
  assert.equal(sloppy.sentences[1].status,'good'); // ー slip forgiven
  assert.equal(lessonRunTotal(100,0.5),88); assert.equal(lessonRunTotal(80,null),80);
});
test('lesson API validates and scores a continuous transcript', async () => {
  const call=(b)=>POST_LESSON(new Request('http://local/api/score/lesson',{method:'POST',body:JSON.stringify(b)}));
  assert.equal((await call({sentences:[],transcript:'x'})).status,400);
  assert.equal((await call({sentences:['はい'],transcript:''})).status,422);
  const res=await call({sentences:['本日はSuperTransの会議です。','PMの斎藤です。','よろしくお願いします。'],transcript:'本日はスーパートランスの会議ですPMの斎藤ですよろしくお願いします'});
  const body=await res.json();
  assert.equal(res.status,200); assert.deepEqual(body.sentences.map(s=>s.status),['good','good','good']);
});
