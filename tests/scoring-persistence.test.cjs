const fs = require('node:fs');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Client } = require('pg');
const config = {host:'127.0.0.1',port:55439,user:'postgres',password:'local-audit-only',database:'postgres'};
(async()=>{
 const db=new Client(config); await db.connect();
 // Only the disposable local Docker database; never reads .env.
 await db.query(`create schema auth; create role anon; create role authenticated;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.user_id',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select '{}'::jsonb$$;`);
 // The base schema's views expect the separately deployed lesson slug column.
 await db.query(fs.readFileSync('supabase/schema.sql','utf8').replace('create table if not exists public.lessons (', 'create table if not exists public.lessons (slug text,'));
 await db.query(fs.readFileSync('supabase/shadowing-attempt-v2.sql','utf8'));
 await db.query('grant usage on schema public,auth to authenticated; grant select,insert,update,delete on all tables in schema public to authenticated;');
 const owner=randomUUID(),lesson=randomUUID(),sentence=randomUUID();
 await db.query('insert into auth.users(id,email) values($1,$2)',[owner,'audit@example.invalid']);
 await db.query('insert into lessons(id,user_id,title,is_public) values($1,$2,$3,true)',[lesson,owner,'Audit']);
 await db.query('insert into lesson_sentences(id,lesson_id,order_index,ja_text) values($1,$2,0,$3)',[sentence,lesson,'こんにちは']);
 const profile=(await db.query('select * from profiles where id=$1',[owner])).rows[0];
 const now=new Date().toISOString();
 function command(expectedCount=0,expectedXp=0){ return {
 attempt:{id:randomUUID(),user_id:owner,lesson_id:lesson,sentence_id:sentence,pronunciation_score:100,speed_score:null,coverage_score:100,intonation_score:null,total_score:100,is_passed:true,transcript_text:'こんにちは',created_at:now},
 profile:{...profile,total_xp:expectedXp+10},
 progress:{id:randomUUID(),user_id:owner,lesson_id:lesson,status:'completed',passed_sentence_count:1,total_sentence_count:1,completed_at:now,updated_at:now},
 mission:{id:randomUUID(),user_id:owner,mission_date:now.slice(0,10),target_sentence_count:5,passed_sentence_count:1,is_completed:false,reading_target:1,reading_count:0,vocab_target:10,vocab_count:0,bonus_awarded:false,created_at:now},
 xp_events:[{id:randomUUID(),user_id:owner,lesson_id:lesson,sentence_id:sentence,event_type:'sentence_pass',xp_amount:10,created_at:now}],
 expected_xp:expectedXp,expected_attempt_count:expectedCount
 }; }
 async function connect(){const c=new Client(config);await c.connect();await c.query("select set_config('app.user_id',$1,false)",[owner]);await c.query('set role authenticated');return c;}
 const c=await connect(); const payload=command();
 const save=(conn,p)=>conn.query('select save_shadowing_attempt_v2($1::jsonb) as result',[JSON.stringify(p)]);
 await save(c,payload); const duplicate=await save(c,payload);assert.equal(duplicate.rows[0].result.duplicate,true);
 assert.equal(Number((await db.query('select count(*) as n from xp_events')).rows[0].n),1);
 const other=await connect();
 const concurrent=await Promise.allSettled([save(c,command(1,10)),save(other,command(1,10))]);
 assert.equal(concurrent.filter(r=>r.status==='fulfilled').length,1);
 const belowThreshold=command(2,20);belowThreshold.attempt.total_score=79;
 await assert.rejects(()=>save(c,belowThreshold),/invalid_score/);
 const broken=command(2,20);broken.xp_events[0].user_id=randomUUID();
 await assert.rejects(()=>save(c,broken),/event_mismatch/);
 assert.equal(Number((await db.query('select count(*) as n from sentence_attempts')).rows[0].n),2);
 assert.equal((await db.query('select total_xp from profiles where id=$1',[owner])).rows[0].total_xp,20);
 console.log('PASS: RPC compiles against repository schema; authenticated/RLS save; duplicate replay; concurrent stale rejection; full rollback after late failure; nullable speed.');
 await c.end();await other.end();await db.end();
})().catch(error=>{console.error(error);process.exit(1);});
