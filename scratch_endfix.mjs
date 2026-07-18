import { readFileSync, renameSync } from "node:fs"; import { spawnSync } from "node:child_process"; import pg from "pg";
const env=Object.fromEntries(readFileSync(".env","utf8").split("\n").filter(l=>l.trim()&&!l.startsWith("#")).map(l=>{const i=l.indexOf("=");return[l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const rx=env.SUPABASE_DB_URL.match(/^postgres(?:ql)?:\/\/(.+)@([^/]+)\/(.+?)(?:\?.*)?$/);const ui=rx[1],ci=ui.indexOf(":"),[h,p]=rx[2].split(":");
const c=new pg.Client({user:ui.slice(0,ci),password:ui.slice(ci+1),host:h,port:+p||5432,database:rx[3],ssl:{rejectUnauthorized:false}});
const src="resources/n2/3. N2 7-2012/3. Nghe N2 7-2012.mp3";
const dur=(f)=>parseFloat(spawnSync("ffprobe",["-v","error","-show_entries","format=duration","-of","csv=p=0",f],{encoding:"utf8"}).stdout.trim());
const PUN=/[\s　、。！？!?「」『』（）()・･…‥,.\-ー~〜]/g;
const norm=s=>(s||"").replace(PUN,"");
// nguồn char-stream + thời gian
const W=JSON.parse(readFileSync("resources/generated/n2-whisper/2012-07-full.json","utf8")).segments.flatMap(s=>s.words||[]);
const Rc=[],Rs=[],Re=[];
for(const w of W){ const t=norm(w.word); for(let k=0;k<t.length;k++){ Rc.push(t[k]); Rs.push(w.start); Re.push(w.end); } }
// SW cục bộ: khớp query (chuỗi ký tự) vào Rc, trả {i0,i1} chỉ số
function sw(Q){ const n=Q.length,m=Rc.length,MA=2,MI=-1,GAP=-2;
  let prev=new Int32Array(m+1),po=new Int32Array(m+1),cur=new Int32Array(m+1),co=new Int32Array(m+1),best=0,bE=0,bS=0;
  for(let i=1;i<=n;i++){ for(let j=1;j<=m;j++){ let s=prev[j-1]+(Q[i-1]===Rc[j-1]?MA:MI),o=po[j-1];
    const up=prev[j]+GAP; if(up>s){s=up;o=po[j];} const lf=cur[j-1]+GAP; if(lf>s){s=lf;o=co[j-1];}
    if(s<=0){s=0;o=j;} cur[j]=s;co[j]=o; if(s>best){best=s;bE=j;bS=o;} }
    [prev,cur]=[cur,prev];[po,co]=[co,po];cur.fill(0);co.fill(0); }
  return {i0:bS, i1:bE, score:best};
}
await c.connect();
const L=await c.query("select id,media_url from public.lessons where media_url like '/audio/n2/2012-07/%' order by media_url");
let fixed=0, checked=0;
for(const {id,media_url} of L.rows){
  const mp3="public"+media_url; const name=media_url.split('/').pop();
  const s=await c.query("select order_index, audio_start st, audio_end en, ja_text from public.lesson_sentences where lesson_id=$1 order by order_index",[id]);
  const first=s.rows[0], last=s.rows[s.rows.length-1];
  const q0=norm(first.ja_text).slice(0,16), qL=norm(last.ja_text).slice(-16);
  if(q0.length<5||qL.length<5) continue;
  const L0=sw([...q0]), LL=sw([...qL]);
  if(L0.score<8||LL.score<8){ console.log(`${name}  SKIP (khó định vị s0=${L0.score} sL=${LL.score})`); continue; }
  const trueStart0=Rs[L0.i0-1]??Rs[0];          // source time câu đầu bắt đầu
  const trueEndL=Re[Math.min(Re.length-1,LL.i1-1)]; // source time câu cuối kết thúc
  const sourceStart=trueStart0 - Number(first.st); // clip[0].st ↔ trueStart0
  const d=dur(mp3); const curEnd=sourceStart+d;
  checked++;
  const need = trueEndL + 0.35;  // muốn clip tới đây
  if(curEnd < need - 0.15){ // đuôi bị cắt
    const tmp=mp3+".t.mp3";
    const r=spawnSync("ffmpeg",["-y","-hide_banner","-loglevel","error","-ss",String(sourceStart.toFixed(3)),"-to",String(need.toFixed(3)),"-i",src,"-c:a","libmp3lame","-b:a","128k",tmp],{encoding:"utf8"});
    if(r.status!==0){console.log(name,"ffmpeg fail");continue;}
    renameSync(tmp,mp3);
    const nd=dur(mp3);
    await c.query("update public.lesson_sentences set audio_end=$1 where lesson_id=$2 and order_index=$3",[Number((nd).toFixed(2)),id,last.order_index]);
    console.log(`${name}  ĐUÔI CẮT: curEnd=${curEnd.toFixed(1)} trueEnd=${trueEndL.toFixed(1)} → nới tới ${need.toFixed(1)} (clip ${d.toFixed(1)}→${nd.toFixed(1)}s)`);
    fixed++;
  }
}
console.log(`\nchecked=${checked} fixed=${fixed}`);
await c.end();
