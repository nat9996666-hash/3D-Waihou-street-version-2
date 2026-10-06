/* =====================================================================
   SCORE SERVICE for the TTM Safety Challenge (Waihou Road).

   The game (waihou/index.html) talks to this at /.netlify/functions/waihou-scores.
   It keeps one record per day in Netlify Blobs:
     - every player who signed in: name, organisation, runs used, both scores, best score, setups picked
     - a count of people walked off site: rude names, made-up names, and chicken chasers (a count only, no names)
   That record is what the live Top 10, the projector scoreboard and the Admin page all read.

   Nothing here needs changing to go live. The one thing you might change:
     ADMIN_CODE  the same code as ADMIN_CODE in waihou/index.html. Keep the two the same.
   ===================================================================== */
import { getStore } from '@netlify/blobs';

const ADMIN_CODE = process.env.ADMIN_CODE || '1991';
const STORE = 'waihou-road-scores';     // the name of the saved-data store in Netlify Blobs
const MAX_RUNS = 2;                      // same as MAX_RUNS in waihou/index.html
const SETUPS = ['build', 'done'];
const LIMIT = { players: 3000, score: 100000, body: 20000, ids: 600, count: 1000000 };

/* ---------- name check ----------
   The same lists and rules as in waihou/index.html. Keep the two the same. */
const RUDE_WORDS=('fuck fucks fucker fuckers fucked fucking fuckin fucken fuckoff fuckyou fuckface fuckwit fuckhead fck fuq phuck phuk fuking fukin motherfucker '+
 'shit shits shitty shite shithead shitface shitbag bullshit cunt cunts cunty sickcunt madcunt dumbcunt bitch bitches biatch wank wanker wankers tosser twat twats '+
 'cock cocks cocksucker dickhead dickheads dickface knobhead bellend arsehole arseholes asshole assholes penis vagina dildo boob boobs boobies tits titties pussy anus '+
 'cum cumshot jizz blowjob handjob rimjob horny slut sluts whore whores pornstar porno pornhub sex sexy milf dilf bastard piss pissoff '+
 'nigger niggers nigga faggot faggots fag retard retarded rapist rape pedo paedo pedophile paedophile nazi hitler').split(' ');
const RUDE_PARTS='fuck motherf nigger nigga dickhead shithead bullshit asshole arsehole cocksuck blowjob wanker bigdick bigcock suckmy deeznuts pornhub hitler'.split(' ');
const RUDE_PHRASES=['big dick','my dick','your dick','suck my','suck it','dick head','dick face','big cock','my cock','deez nuts','ball sack','nut sack','big boobs','big tits','jack off','jerk off','f off','f u','eat my','lick my','kiss my'];
const RUDE_STARRED=[/(^|[^a-z])f[*#@$%!_]{1,3}c?k/,/(^|[^a-z])sh[*#@$%!_]{1,2}t(?![a-z])/,/(^|[^a-z])c[*#@$%!_]{1,2}nt/,/(^|[^a-z])b[*#@$%!_]{1,2}tch/];
const LEET={'0':'o','1':'i','3':'e','4':'a','5':'s','7':'t','@':'a','$':'s','!':'i'};
function nameWords(s){
  const t=String(s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/['’`]/g,'').replace(/[013457@$!]/g,c=>LEET[c]).split(/[^a-z]+/).filter(Boolean);
  const out=t.slice();let run='';   /* "f u c k" typed with gaps reads as one word */
  for(const w of t.concat([''])){if(w.length===1)run+=w;else{if(run.length>2)out.push(run);run='';}}
  return{words:t,all:out};
}
function isRude(s){
  const raw=String(s||'').toLowerCase(),W=nameWords(s);
  if(RUDE_STARRED.some(r=>r.test(raw)))return true;
  for(const w of W.all){
    const forms=[w,w.replace(/(.)\1{2,}/g,'$1'),w.replace(/(.)\1{2,}/g,'$1$1')];   /* "fuuuuck" reads as "fuck" */
    for(const f of forms){if(RUDE_WORDS.includes(f)||RUDE_PARTS.some(p=>f.includes(p)))return true;}
  }
  const line=' '+W.words.join(' ')+' ';
  return RUDE_PHRASES.some(p=>line.includes(' '+p+' '));
}
/* ---------- end of the part shared with waihou/index.html ---------- */

/* ---------- small helpers ---------- */
class Reply extends Error { constructor(status, error) { super(error); this.status = status; this.error = error; } }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});
const isInt = (v, max) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= max;
const text = (v, max) => typeof v === 'string'
  ? v.replace(/[\u0000-\u001f\u007f-\u009f‪-‮⁦-⁩]/g, '').replace(/\s+/g, ' ').trim().slice(0, max) : '';
function validDay(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || v < '2020-01-01') return false;
  const d = new Date(v + 'T00:00:00.000Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
}
const validKey = k => typeof k === 'string' && /^[a-z0-9][a-z0-9-]{0,95}$/.test(k) && !['constructor', 'prototype'].includes(k);
const dayKey = day => 'day/' + day;

/* One player's record, with anything unexpected thrown away. */
function cleanRec(v, day) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const out = { first: text(v.first, 24), last: text(v.last, 24), org: text(v.org, 40), day };
  if (!out.first || !out.last) return null;
  out.attempts = isInt(v.attempts, MAX_RUNS) ? v.attempts : isInt(v.attempts, LIMIT.count) ? MAX_RUNS : 0;
  for (const f of ['s1', 's2', 'best']) if (isInt(v[f], LIMIT.score)) out[f] = v[f];
  for (const f of ['setup1', 'setup2']) if (SETUPS.includes(v[f])) out[f] = v[f];
  for (const f of ['started', 'updated']) if (isInt(v[f], 8640000000000000)) out[f] = v[f];
  return out;
}
/* A new save never takes a run or a score away from what is already on the board. */
function merge(old, rec) {
  const out = Object.assign({}, old || {}, rec);
  out.attempts = Math.max(old && old.attempts || 0, rec.attempts || 0);
  const scores = [out.s1, out.s2, old && old.best, rec.best].filter(n => isInt(n, LIMIT.score));
  if (scores.length) out.best = Math.max(...scores);
  if (out.s2 !== undefined) out.attempts = Math.max(out.attempts, 2);
  else if (out.best !== undefined) out.attempts = Math.max(out.attempts, 1);
  return out;
}
const blank = day => ({ v: 1, day, players: Object.create(null), events: { police: 0, security: 0, chicken: 0, ids: [] } });
/* Whatever was saved, hand back a record in the right shape. */
function tidy(data, day) {
  const doc = blank(day);
  if (!data || typeof data !== 'object') return doc;
  const p = data.players;
  if (p && typeof p === 'object' && !Array.isArray(p)) {
    for (const k of Object.keys(p)) { if (!validKey(k)) continue; const r = cleanRec(p[k], day); if (r) doc.players[k] = r; }
  }
  const e = data.events;
  if (e && typeof e === 'object') {
    for (const k of ['police', 'security', 'chicken']) if (isInt(e[k], LIMIT.count)) doc.events[k] = e[k];
    if (Array.isArray(e.ids)) doc.events.ids = e.ids.filter(x => typeof x === 'string').slice(-LIMIT.ids);
  }
  return doc;
}
const answer = doc => ({ ok: true, day: doc.day, players: doc.players, events: { police: doc.events.police, security: doc.events.security, chicken: doc.events.chicken } });

/* ---------- reading and saving ----------
   Reads ask for the newest copy ("strong"). Saves only go through if nobody else saved in between;
   if someone did, read again and retry. That way two iPads finishing at the same moment both land. */
let strong = true;         // falls back to ordinary reads if this site cannot do newest-copy ones
let checkedWorks = false;  // true once a checked save has gone through, so we know they work here
let plainSaves = false;    // last resort: ordinary saves, if checked saves are refused every single time
let givenUp = 0;
const open = () => strong ? getStore({ name: STORE, consistency: 'strong' }) : getStore(STORE);

async function load(day) {
  for (;;) {
    try {
      const hit = await open().getWithMetadata(dayKey(day), { type: 'json' });
      return hit ? { doc: tidy(hit.data, day), etag: hit.etag || null, found: true } : { doc: blank(day), etag: null, found: false };
    } catch (e) {
      if (strong && /consisten/i.test(String(e && e.name) + ' ' + String(e && e.message))) { strong = false; continue; }
      throw e;
    }
  }
}
/* change(day, edit): edit(doc) alters the day's record. Return false from edit when there is nothing to save. */
async function change(day, edit) {
  const key = dayKey(day);
  for (let turn = 0; turn < 8; turn++) {
    const cur = await load(day);
    if (edit(cur.doc) === false) return cur.doc;
    if (plainSaves || (cur.found && !cur.etag)) { await open().setJSON(key, cur.doc); return cur.doc; }
    const res = await open().setJSON(key, cur.doc, cur.found ? { onlyIfMatch: cur.etag } : { onlyIfNew: true });
    if (!res || res.modified !== false) { checkedWorks = true; givenUp = 0; return cur.doc; }
    await sleep(20 + Math.random() * 60 * (turn + 1));   /* someone else saved first: look again and retry */
  }
  /* Refused eight times running. If checked saves are known to work here it is just a very busy moment:
     say "busy" and the game sends the score again by itself. If they have never worked, save the ordinary way. */
  if (checkedWorks || !strong) throw new Reply(503, 'busy');
  if (++givenUp >= 2) plainSaves = true;
  const cur = await load(day);
  if (edit(cur.doc) === false) return cur.doc;
  await open().setJSON(key, cur.doc);
  return cur.doc;
}
function needCode(b) { if (String(b.code == null ? '' : b.code) !== ADMIN_CODE) throw new Reply(403, 'code'); }

/* ---------- the service ---------- */
export default async function handler(req) {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method === 'GET') {
      const day = new URL(req.url).searchParams.get('day');
      if (day === null) {
        /* Opened on its own in a browser: a quick check that the service and its storage are working. */
        try { await load('2020-01-01'); return json({ ok: true, service: 'TTM Safety Challenge scores (Waihou Road)', storage: 'working' }); }
        catch (e) { console.error('scores check', e); return json({ ok: false, service: 'TTM Safety Challenge scores (Waihou Road)', storage: 'not working', detail: String(e && e.message || e).slice(0, 300) }, 500); }
      }
      if (!validDay(day)) throw new Reply(400, 'day');
      return json(answer((await load(day)).doc));
    }
    if (req.method !== 'POST') throw new Reply(405, 'method');
    const raw = await req.text();
    if (raw.length > LIMIT.body) throw new Reply(413, 'size');
    let b = null; try { b = JSON.parse(raw); } catch (e) {}
    if (!b || typeof b !== 'object' || Array.isArray(b)) throw new Reply(400, 'body');
    const day = b.day;
    if (!validDay(day)) throw new Reply(400, 'day');

    switch (b.op) {
      /* a player started a run, or finished one */
      case 'set': {
        const rec = cleanRec(b.rec, day);
        if (!validKey(b.key) || !rec) throw new Reply(400, 'record');
        if (isRude(rec.first + ' ' + rec.last) || isRude(rec.org)) throw new Reply(400, 'name');
        return json(answer(await change(day, doc => {
          const old = doc.players[b.key];
          if (!old && Object.keys(doc.players).length >= LIMIT.players) throw new Reply(507, 'full');
          doc.players[b.key] = merge(old, rec);
        })));
      }
      /* admin: take one player off the board */
      case 'remove': {
        needCode(b);
        if (!validKey(b.key)) throw new Reply(400, 'key');
        return json(answer(await change(day, doc => { if (!doc.players[b.key]) return false; delete doc.players[b.key]; })));
      }
      /* admin: clear the day. A copy of what was there is kept first, in case it was a mistake. */
      case 'clear': {
        needCode(b);
        const before = (await load(day)).doc;
        if (Object.keys(before.players).length || before.events.police || before.events.security || before.events.chicken) {
          try { await open().setJSON('cleared/' + day + '/' + Date.now(), before); } catch (e) {}
        }
        return json(answer(await change(day, doc => { doc.players = Object.create(null); doc.events = { police: 0, security: 0, chicken: 0, ids: [] }; })));
      }
      /* someone was walked off site. A count only. The id stops the same one being counted twice. */
      case 'event': {
        const id = text(b.id, 96);
        if (!['police', 'security', 'chicken'].includes(b.kind) || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/.test(id)) throw new Reply(400, 'event');
        return json(answer(await change(day, doc => {
          if (doc.events.ids.includes(id)) return false;
          doc.events[b.kind] = Math.min(LIMIT.count, doc.events[b.kind] + 1);
          doc.events.ids.push(id); doc.events.ids = doc.events.ids.slice(-LIMIT.ids);
        })));
      }
      /* name check with the same word list as the game */
      case 'check':
        return json({ ok: true, by: 'list', verdict: (isRude(text(b.first, 24) + ' ' + text(b.last, 24)) || isRude(text(b.org, 40))) ? 'police' : '' });
      case 'aitest':
        needCode(b);
        return json({ ok: true, ai: 'off' });
      default:
        throw new Reply(400, 'op');
    }
  } catch (e) {
    if (e instanceof Reply) { if (e.status === 403) await sleep(400); return json({ ok: false, error: e.error }, e.status); }
    console.error('scores', e);
    return json({ ok: false, error: 'server' }, 500);
  }
}
