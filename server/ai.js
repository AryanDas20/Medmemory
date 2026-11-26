'use strict';
/* MedMemory AI engine: Gemini (when GEMINI_API_KEY is set) + deterministic safety layer (always on) */
const KEY = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const MODEL = () => process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const SPECIALTIES = ['General Physician', 'Orthopaedics', 'Cardiology', 'Endocrinology', 'Dermatology', 'Neurology'];

async function gemini({ system, prompt, parts, json = true, timeoutMs = 16000 }) {
  if (!KEY()) throw new Error('no-key');
  const body = {
    systemInstruction: system ? { parts: [{ text: system }] } : undefined,
    contents: [{ role: 'user', parts: parts || [{ text: prompt }] }],
    generationConfig: { temperature: 0.3, ...(json ? { responseMimeType: 'application/json' } : {}) },
  };
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL()}:generateContent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY() },
    body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs),
  });
  if (!r.ok) throw new Error('gemini ' + r.status);
  const d = await r.json();
  const t = (d.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
  if (!json) return t;
  return JSON.parse(t.replace(/^```json|```$/g, '').trim());
}
const aiOn = () => !!KEY();

/* ---------- record helpers ---------- */
const active = rec => rec.history.filter(h => h.status !== 'recovered');
const has = (rec, re) => active(rec).some(h => re.test(h.name + ' ' + (h.body_part || '')));
function ctxText(rec) {
  const L = [];
  L.push(`Patient: ${rec.user.name}, ${rec.profile.age || '?'} yrs, ${rec.profile.gender || ''}, blood ${rec.profile.blood_group || '?'}`);
  L.push('Conditions/injuries: ' + (rec.history.map(h => `${h.name} (${h.type}, ${h.status}, ${h.date || 'n/a'}${h.notes ? ', ' + h.notes : ''})`).join('; ') || 'none'));
  L.push('Allergies: ' + (rec.allergies.map(a => `${a.allergen} (${a.severity}, ${a.reaction || ''})`).join('; ') || 'none'));
  L.push('Medicines: ' + (rec.medications.map(m => `${m.name} ${m.dosage || ''}`).join('; ') || 'none'));
  L.push('Recent symptoms: ' + (rec.symptoms.slice(0, 4).map(s => `${s.description} (${s.severity}/10)`).join('; ') || 'none'));
  L.push('Lab trends: ' + (rec.trends.map(t => `${t.test} ${t.points.map(p => p.value).join('→')} ${t.unit || ''} [${t.latest.status}]`).join('; ') || 'none'));
  return L.join('\n');
}

/* ---------- deterministic safety layer ---------- */
const RED = /chest pain|chest tightness|seene me dard|seene mein dard|pressure in (my )?chest|can'?t breathe|cannot breathe|difficulty breathing|saans (lene )?(me|mein) (takleef|dikkat)|unconscious|behosh|faint(ed|ing)|stroke|face droop|slurred speech|one side (weak|numb)|severe bleeding|vomiting blood|coughing blood|seizure|dora|suicid|want to die|overdose|poison/i;
function redFlag(msg) {
  const m = msg.toLowerCase();
  if (/chest/.test(m) && /(sweat|pasina|breath|left arm|jaw|nausea)/.test(m)) return 'Chest pain with sweating or breathlessness can be a heart attack.';
  if (RED.test(m)) return 'The symptoms you describe can be serious and need urgent medical attention.';
  return null;
}
const GUARD = [
  { when: /yoga|exercise|workout|gym|stretch|asana|fitness|run|jog/i, rules: [
    [r => /neck|cervical/i.test(r), ['Headstand (neck strain)', 'Plough pose (neck strain)', 'Neck rolls (neck strain)']],
    [r => /back|spine|lumbar|disc|sciatica/i.test(r), ['Deep forward bends and heavy deadlifts (back/spine problem)']],
    [r => /knee|acl|meniscus/i.test(r), ['Deep squats, full lotus and downhill running (knee injury)']],
    [r => /asthma/i.test(r), ['Forceful breathing like kapalbhati or cold-air outdoor runs without warm-up (asthma)']],
    [r => /hypertension|high bp|blood pressure|\bbp\b/i.test(r), ['Inversions, breath-holding and heavy lifting (high blood pressure)']],
    [r => /shoulder/i.test(r), ['Overhead presses and arm-balance poses (shoulder problem)']],
  ] },
  { when: /sweet|sugar|mithai|dessert|snack|diet|food|eat|khana|chai|juice|cake/i, rules: [
    [r => /diabet|sugar|hba1c|glucose/i.test(r), ['Mithai, sugary drinks and refined sugar (diabetes / high sugar)']],
    [r => /hypertension|high bp|blood pressure|\bbp\b/i.test(r), ['Salty snacks, pickles and papad (high blood pressure)']],
  ] },
];
const DRUGS = [
  { re: /amoxicillin|ampicillin|penicillin|augmentin|co-?amoxiclav/i, cls: 'penicillin', allergy: /penicillin|amoxicillin|beta.?lactam/i },
  { re: /cef(?:ixime|uroxime|podoxime|alexin)|cephalexin|ceftriaxone/i, cls: 'cephalosporin', allergy: /penicillin|cephalosporin/i, soft: true },
  { re: /cotrimoxazole|co-?trimoxazole|bactrim|septran|sulfamethoxazole|sulpha|sulfa/i, cls: 'sulfa', allergy: /sulfa|sulpha|sulfonamide|cotrimoxazole/i },
  { re: /ibuprofen|brufen|diclofenac|voveran|naproxen|aspirin|disprin|nimesulide|mefenamic|ketorolac/i, cls: 'nsaid', cond: [[/asthma/i, 'NSAIDs can trigger breathing problems in some people with asthma.'], [/hypertension|high bp|blood pressure/i, 'NSAIDs can raise blood pressure.'], [/ulcer|gastritis|acidity|kidney|ckd/i, 'NSAIDs can irritate the stomach and strain the kidneys.']], allergy: /nsaid|ibuprofen|aspirin|diclofenac/i },
  { re: /paracetamol|acetaminophen|crocin|dolo|calpol/i, cls: 'paracetamol', safeNote: 'Generally the safest common pain/fever medicine. Stay within the labelled daily dose and avoid with heavy alcohol or liver disease.' },
  { re: /metformin|glycomet/i, cls: 'metformin', cond: [[/kidney|ckd/i, 'Metformin needs dose review with reduced kidney function.']] },
  { re: /cetirizine|levocetirizine|loratadine|antihistamine/i, cls: 'antihistamine', safeNote: 'Can cause drowsiness; avoid driving after a dose.' },
  { re: /azithromycin|azithral|clarithromycin|erythromycin|doxycycline|ciprofloxacin|levofloxacin|antibiotic/i, cls: 'antibiotic', cond: [], safeNote: 'Antibiotics should only be taken on a doctor\'s prescription and for the full course.' },
  { re: /omeprazole|pantoprazole|pan 40|rabeprazole|antacid/i, cls: 'ppi', safeNote: 'Usually fine for short use; long-term use needs a doctor\'s review.' },
  { re: /salbutamol|asthalin|levolin/i, cls: 'reliever', safeNote: 'Reliever inhaler; if you need it more than usual, see your doctor.' },
  { re: /amlodipine|telmisartan|losartan|atenolol|metoprolol/i, cls: 'bp-med', cond: [[/asthma/i, 'Some blood-pressure tablets (especially beta-blockers like atenolol/metoprolol) can worsen asthma.']] },
];
function medicineCheck(name, rec) {
  const n = name.trim();
  const reasons = []; let verdict = 'safe'; const bump = v => { const o = { safe: 0, caution: 1, avoid: 2 }; if (o[v] > o[verdict]) verdict = v; };
  const condText = active(rec).map(h => h.name).join(' | ');
  const meds = rec.medications.map(m => m.name).join(' | ');
  const d = DRUGS.find(x => x.re.test(n));
  rec.allergies.forEach(a => { if (n.toLowerCase().includes(a.allergen.toLowerCase()) || a.allergen.toLowerCase().includes(n.toLowerCase())) { reasons.push(`You have a recorded ${a.severity} allergy to ${a.allergen}.`); bump('avoid'); } });
  if (d) {
    rec.allergies.forEach(a => { if (d.allergy && d.allergy.test(a.allergen)) { reasons.push(`${n} is in the same drug family as your recorded ${a.allergen} allergy${d.soft ? ' (cross-reaction is possible)' : ''}.`); bump(d.soft ? 'caution' : 'avoid'); } });
    (d.cond || []).forEach(([re, why]) => { if (re.test(condText)) { reasons.push(why); bump('caution'); } });
    if (d.cls === 'nsaid' && /aspirin|ibuprofen|diclofenac|naproxen/i.test(meds)) { reasons.push('You already take a similar painkiller; combining them raises side-effect risk.'); bump('caution'); }
    if (!reasons.length && d.safeNote) reasons.push(d.safeNote);
  } else if (!reasons.length) { reasons.push('This medicine is not in the built-in safety list, so it could not be fully checked against your record.'); bump('caution'); }
  if (!reasons.length) reasons.push('No conflict found with your recorded allergies, conditions or medicines.');
  const advice = verdict === 'avoid' ? 'Do not take this without asking your doctor or pharmacist first. Show them your allergy list.'
    : verdict === 'caution' ? 'Check with your doctor or pharmacist before taking it, and mention your conditions and current medicines.'
    : 'No conflict found in your record. Follow the label or your doctor\'s dosage, and ask a pharmacist if unsure.';
  return { medicine: n, verdict, reasons, advice };
}
function conflictGuard(msg, rec) {
  const hist = active(rec).map(h => `${h.name} ${h.body_part || ''}`).join(' | ') + ' ' + rec.trends.filter(t => t.latest.status === 'high').map(t => t.test).join(' ');
  const out = [];
  GUARD.forEach(g => { if (g.when.test(msg)) g.rules.forEach(([t, items]) => { if (t(hist)) out.push(...items); }); });
  if (/antibiotic|amoxicillin|penicillin|medicine|tablet|dawai|painkiller|ibuprofen|aspirin|brufen/i.test(msg)) {
    const found = DRUGS.filter(x => x.re.test(msg));
    found.forEach(f => { const r = medicineCheck(msg.match(f.re)[0], rec); if (r.verdict !== 'safe') out.push(`${r.medicine}: ${r.reasons[0]}`); });
    if (/antibiotic/i.test(msg) && rec.allergies.some(a => /penicillin/i.test(a.allergen))) out.push('Penicillin-class antibiotics (penicillin allergy)');
    if (/painkiller|pain ?killer|dard ki dawai/i.test(msg)) { if (has(rec, /asthma/i)) out.push('NSAID painkillers such as ibuprofen or aspirin (asthma)'); if (has(rec, /hypertension|high bp/i)) out.push('Regular NSAID use (high blood pressure)'); }
  }
  return [...new Set(out)];
}

/* ---------- rule-based chat (used when no Gemini key, or Gemini fails) ---------- */
function ruleChat(msg, rec) {
  const m = msg.toLowerCase(); const hi = /[^\x00-\x7F]|mujhe|mere|dard|hai\b|kya|nahi|thakaan|bukhar|sir |kaise/.test(m);
  const r = { reply: '', urgency: 'low', specialty: 'General Physician', suggested_checkups: [], follow_up_questions: [], used: [] };
  const L = rec.trends.find(t => /hba1c|sugar|glucose/i.test(t.test));
  if (/yoga|workout|gym|exercise|asana|fitness|run|jog/.test(m)) {
    r.reply = hi ? 'Stress ke liye dheere, low-impact yoga best hai: 5 minute deep breathing, seated cat-cow (gentle) aur legs-up-the-wall. Pehle 10–15 minute se shuru karo aur dard ya chakkar aaye to ruk jao.'
      : 'For stress, start with slow, low-impact yoga: 5 minutes of deep breathing, gentle seated cat-cow and legs-up-the-wall. Begin with 10–15 minutes and stop if you feel pain or dizziness.';
    r.specialty = has(rec, /neck|spine|back|knee/i) ? 'Orthopaedics' : 'General Physician';
    r.suggested_checkups = ['Posture check if neck or back pain persists'];
    r.follow_up_questions = ['Is it okay to do yoga every day?', 'Which breathing exercises are safe for me?'];
  } else if (/headache|sir (me )?dard|sir mein dard|migraine|head hurts/.test(m)) {
    r.reply = hi ? 'Sir dard ke liye aaraam karo, paani piyo aur andhere shaant kamre me lete raho. Agar 2–3 din se zyada rahe ya bahut tez ho to doctor ko dikhao.'
      : 'For a headache: rest, drink water, and lie in a quiet dark room. See a doctor if it lasts more than 2–3 days, keeps returning, or is severe.';
    r.urgency = 'medium'; r.specialty = 'Neurology'; r.suggested_checkups = ['Blood pressure check', 'Eye test if screen use is high'];
    r.follow_up_questions = ['Is it worse in the morning?', 'Do I have any warning signs?'];
  } else if (/sugar|diabet|hba1c|glucose|meetha/.test(m)) {
    r.reply = L ? `Your ${L.test} went ${L.points.map(p => p.value).join(' → ')} ${L.unit || ''} and is ${L.latest.status === 'high' ? 'above' : 'within'} the normal range (${L.normal_range || 'n/a'}). A rising trend deserves a doctor review, plus less sugar, regular walks and a repeat test in 3 months.`
      : 'I do not see a sugar report yet. Upload a recent blood sugar or HbA1c report and I will compare it with your earlier values.';
    r.urgency = L && L.latest.status === 'high' ? 'medium' : 'low'; r.specialty = 'Endocrinology'; r.suggested_checkups = ['HbA1c', 'Fasting blood sugar', 'Lipid profile'];
    r.follow_up_questions = ['What should I eat to bring it down?', 'How often should I test?'];
  } else if (/checkup|check-up|test due|screening/.test(m)) {
    r.reply = 'Based on your record, these checkups make sense now. Ask a doctor to confirm the schedule.';
    r.suggested_checkups = ['HbA1c and fasting sugar', 'Lipid profile', 'Vitamin D and B12', 'Blood pressure check'];
    r.follow_up_questions = ['Can I book a doctor for these?'];
  } else if (/fever|bukhar|cold|cough|khansi|sore throat|gala/.test(m)) {
    r.reply = 'Rest, warm fluids and a salt-water gargle help most viral colds. Check your temperature; see a doctor if fever lasts more than 3 days, goes above 102°F, or you feel short of breath.';
    r.urgency = 'medium'; r.suggested_checkups = ['Temperature log'];
    r.follow_up_questions = ['When should I worry about my fever?'];
  } else if (/report|result|explain/.test(m)) {
    r.reply = rec.reports.length ? `Your latest report is "${rec.reports[0].title}". ${rec.reports[0].summary || ''}` : 'You have no reports stored yet. Upload one on the Reports page and I will explain it in simple words.';
    r.follow_up_questions = ['Which values should I worry about?'];
  } else {
    r.reply = hi ? 'Main aapke record ko dekh kar jawab deta hoon. Thoda detail batao: kab se hai, kitna tez hai, aur kya aur koi symptom hai?'
      : 'I read your record before answering. Tell me a little more: how long has it been going on, how severe is it, and are there any other symptoms?';
    r.follow_up_questions = ['It started 2 days ago', 'It is mild but constant'];
  }
  return r;
}

async function chat(msg, rec, history) {
  const flag = redFlag(msg);
  const guard = conflictGuard(msg, rec);
  let out = null;
  let engine = 'rules';
  if (aiOn()) {
    try {
      const j = await gemini({
        system: 'You are MedMemory AI, a careful health assistant for Indian patients. Reply in the user\'s language (English or Hinglish). ALWAYS use the patient record. Give safe, general guidance only, never a diagnosis, never prescribe drugs or doses. Never suggest anything that conflicts with the record. Keep the reply under 90 words. Return JSON only: {"reply":string,"urgency":"low|medium|high|emergency","specialty":one of ' + JSON.stringify(SPECIALTIES) + ',"suggested_checkups":string[],"follow_up_questions":string[](max 3),"record_items_used":string[] (names of record items you used),"conflicts_avoided":string[] (things you deliberately did NOT suggest because of the record)}',
        prompt: `PATIENT RECORD:\n${ctxText(rec)}\n\nRECENT CHAT:\n${history.slice(0, 6).reverse().map(h => h.role + ': ' + h.content).join('\n')}\n\nPATIENT MESSAGE: ${msg}`,
        timeoutMs: 6500,
      });
      const reply = String(j.reply || '').trim();
      if (!reply) throw new Error('Gemini returned an empty reply.');
      out = { reply, urgency: j.urgency, specialty: SPECIALTIES.includes(j.specialty) ? j.specialty : 'General Physician', suggested_checkups: Array.isArray(j.suggested_checkups) ? j.suggested_checkups : [], follow_up_questions: Array.isArray(j.follow_up_questions) ? j.follow_up_questions.slice(0, 3) : [], used: Array.isArray(j.record_items_used) ? j.record_items_used : [], ai_conflicts: Array.isArray(j.conflicts_avoided) ? j.conflicts_avoided : [] };
      engine = 'gemini';
    } catch (e) { out = null; }
  }
  if (!out) out = ruleChat(msg, rec);
  const used = new Set(out.used || []);
  active(rec).forEach(h => { if (guard.some(g => g.toLowerCase().includes(h.name.toLowerCase().split(' ')[0])) || msg.toLowerCase().includes(h.name.toLowerCase().split(' ')[0])) used.add(`${h.name}${h.date ? ' · ' + daysAgo(h.date) : ''}`); });
  rec.allergies.forEach(a => { if (guard.some(g => g.toLowerCase().includes(a.allergen.toLowerCase()))) used.add(`${a.allergen} allergy`); });
  rec.trends.forEach(t => { if (new RegExp(t.test.split(' ')[0], 'i').test(msg)) used.add(`${t.test} report`); });
  const meta = {
    urgency: flag ? 'emergency' : (['low', 'medium', 'high', 'emergency'].includes(out.urgency) ? out.urgency : 'low'),
    red_flag: !!flag, ...(flag ? { red_flag_reason: flag } : {}),
    record_items_used: [...used].slice(0, 6), conflicts_avoided: [...new Set([...guard, ...(out.ai_conflicts || [])])].slice(0, 6),
    suggested_checkups: out.suggested_checkups.slice(0, 5), specialty: out.specialty, follow_up_questions: out.follow_up_questions,
    engine, fallback: engine !== 'gemini',
  };
  const content = flag ? `${flag} Please do not wait: call 112 or go to the nearest emergency department now. ${out.reply ? '' : ''}`.trim() : out.reply;
  return { content, meta };
}
function daysAgo(d) { const n = Math.round((Date.now() - new Date(d + 'T00:00:00Z').getTime()) / 864e5); return n <= 0 ? 'today' : n === 1 ? '1 day ago' : n < 60 ? `${n} days ago` : `${Math.round(n / 30)} months ago`; }

/* ---------- lab report parsing ---------- */
const RANGES = { 'fasting blood sugar': [70, 100, 'mg/dL'], 'hba1c': [4, 5.6, '%'], 'haemoglobin': [12, 15.5, 'g/dL'], 'hemoglobin': [12, 15.5, 'g/dL'], 'heart rate': [60, 100, 'bpm'], 'total cholesterol': [null, 200, 'mg/dL'], 'vitamin d': [30, 100, 'ng/mL'], 'ldl': [null, 100, 'mg/dL'], 'hdl': [40, null, 'mg/dL'], 'triglycerides': [null, 150, 'mg/dL'], 'creatinine': [0.6, 1.3, 'mg/dL'], 'tsh': [0.4, 4, 'mIU/L'], 'vitamin b12': [200, 900, 'pg/mL'] };
function parseRange(t) {
  if (!t) return {}; const s = t.replace(/\s/g, '');
  let m = s.match(/^(\d+(?:\.\d+)?)[-–](\d+(?:\.\d+)?)/); if (m) return { low: +m[1], high: +m[2] };
  m = s.match(/^[<≤](\d+(?:\.\d+)?)/); if (m) return { high: +m[1] };
  m = s.match(/^[>≥](\d+(?:\.\d+)?)/); if (m) return { low: +m[1] }; return {};
}
function status(v, low, high) { return high != null && v > high ? 'high' : low != null && v < low ? 'low' : 'normal'; }
function parseReportText(text) {
  const values = [];
  const re = /^\s*([A-Za-z][A-Za-z0-9 \/\-\.()]{1,40}?)\s*[:\-–]\s*([<>]?\d+(?:\.\d+)?)\s*([A-Za-zµ%\/\^0-9\.]*)\s*(?:\(([^)]*)\))?/;
  text.split(/\r?\n/).forEach(line => {
    const m = line.match(re); if (!m) return;
    const test = m[1].trim(); if (/^(date|age|phone|patient|doctor|ref|sample|id|time)/i.test(test)) return;
    const v = parseFloat(m[2].replace(/[<>]/, '')); const key = test.toLowerCase();
    const dr = RANGES[Object.keys(RANGES).find(k => key.includes(k))] || [];
    const pr = parseRange(m[4]); const low = pr.low ?? dr[0] ?? null, high = pr.high ?? dr[1] ?? null;
    const range = m[4] || (dr.length ? (dr[0] != null && dr[1] != null ? `${dr[0]}-${dr[1]}` : dr[1] != null ? `<${dr[1]}` : `>${dr[0]}`) : '');
    values.push({ test_name: test, value: v, unit: m[3] || dr[2] || '', status: status(v, low, high), normal_range: range });
  });
  return values;
}
function reportFallback(text, values) {
  const dm = text.match(/(?:date|dated)\s*[:\-]?\s*(\d{4}-\d{2}-\d{2})/i);
  const lipid = /lipid|cholesterol|ldl|hdl/i.test(text), sugar = /hba1c|glucose|sugar/i.test(text);
  const type = lipid && !sugar ? 'Lipid profile' : sugar && !lipid ? 'Diabetes panel' : 'Blood test';
  const bad = values.filter(v => v.status !== 'normal');
  const key_findings = bad.map(v => `${v.test_name} is ${v.value} ${v.unit} — ${v.status === 'high' ? 'above' : 'below'} the normal range (${v.normal_range || 'n/a'}).`);
  return { report_type: type, report_date: dm ? dm[1] : null,
    summary: values.length ? (bad.length ? `${values.length} values read. ${bad.length} need attention: ${bad.map(v => v.test_name).join(', ')}. Discuss these with your doctor; one report is a snapshot, so watch the trend.` : `${values.length} values read and all are within the normal range.`) : 'No lab values could be read automatically. Try pasting the report text.',
    key_findings: key_findings.length ? key_findings : (values.length ? ['All extracted values are in the normal range.'] : []) };
}
const REPORT_PROMPT = 'Extract this medical lab report. Return JSON only: {"title":string,"report_type":string,"report_date":"YYYY-MM-DD or null","summary":"plain-language 2-3 sentences, no diagnosis","key_findings":string[],"values":[{"test_name":string,"value":number,"unit":string,"low":number|null,"high":number|null}]}';
async function readReport({ text, file }) {
  if (aiOn()) {
    try {
      const parts = file ? [{ inline_data: { mime_type: file.mime, data: file.data.toString('base64') } }, { text: REPORT_PROMPT }] : [{ text: REPORT_PROMPT + '\n\nREPORT TEXT:\n' + text }];
      const j = await gemini({ parts });
      const values = (j.values || []).filter(v => v && v.test_name && isFinite(v.value)).map(v => { const dr = RANGES[Object.keys(RANGES).find(k => v.test_name.toLowerCase().includes(k))] || []; const low = v.low ?? dr[0] ?? null, high = v.high ?? dr[1] ?? null; return { test_name: v.test_name, value: +v.value, unit: v.unit || dr[2] || '', status: status(+v.value, low, high), normal_range: low != null && high != null ? `${low}-${high}` : high != null ? `<${high}` : low != null ? `>${low}` : '' }; });
      return { title: j.title, report_type: j.report_type || 'Blood test', report_date: /^\d{4}-\d{2}-\d{2}$/.test(j.report_date || '') ? j.report_date : null, summary: j.summary || '', key_findings: j.key_findings || [], values };
    } catch (e) { if (file) throw new Error('The AI could not read this file. Try a clearer photo or paste the report text instead.'); }
  }
  if (file) throw new Error('Reading PDFs and photos needs the AI key (GEMINI_API_KEY). Use "Paste text" for now.');
  const values = parseReportText(text); const f = reportFallback(text, values);
  return { title: null, ...f, values };
}

/* ---------- doctor-side AI ---------- */
function briefFallback(rec, extra) {
  const act = active(rec); const high = rec.trends.filter(t => t.latest.status === 'high');
  return {
    one_liner: `${rec.user.name}, ${rec.profile.age || '?'} yrs${rec.profile.gender ? ', ' + rec.profile.gender.toLowerCase() : ''}. ${act.length ? 'Active: ' + act.map(h => h.name).join(', ') + '.' : 'No active conditions recorded.'}${extra ? ' Visit reason: ' + extra + '.' : ''}`,
    allergies_alerts: rec.allergies.map(a => `${a.allergen} (${a.severity})${a.reaction ? ': ' + a.reaction : ''}`),
    key_history: rec.history.slice(0, 5).map(h => `${h.name} (${h.status}${h.date ? ', ' + h.date : ''})`),
    report_changes: rec.trends.filter(t => t.previous).map(t => `${t.test}: ${t.previous.value} → ${t.latest.value} ${t.unit || ''} (${t.latest.status})`),
    current_concerns: [...rec.symptoms.slice(0, 3).map(s => `${s.description} (${s.severity}/10)`), ...high.map(t => `${t.test} above range`)],
    suggested_questions: ['When did it start and is it getting worse?', 'Any new medicines or supplements?', rec.allergies.length ? 'Confirm allergy reactions before prescribing.' : 'Any known drug allergies?'],
    suggested_tests: high.length ? [...new Set(high.map(t => /hba1c|sugar|glucose/i.test(t.test) ? 'Repeat HbA1c and fasting sugar' : /cholesterol|ldl|triglyc/i.test(t.test) ? 'Lipid profile' : `Repeat ${t.test}`))] : ['Basic vitals'],
  };
}
async function brief(rec, extra) {
  if (aiOn()) { try { const j = await gemini({ system: 'You are a clinical copilot preparing a one-screen pre-visit brief for a doctor. Be concise and factual. Do not diagnose. Return JSON only: {"one_liner":string,"allergies_alerts":string[],"key_history":string[],"report_changes":string[],"current_concerns":string[],"suggested_questions":string[],"suggested_tests":string[]}', prompt: ctxText(rec) + (extra ? '\nVisit reason: ' + extra : '') }); return { ...briefFallback(rec, extra), ...j }; } catch (e) { /* fall through */ } }
  return briefFallback(rec, extra);
}
function lines(s) { return (s || '').split(/\n|;|\.\s/).map(x => x.trim()).filter(Boolean); }
async function consultSummary(c, msgs, rec) {
  const fb = { chief_complaint: (lines(c.notes)[0] || c.reason || 'General consultation'), diagnosis: c.diagnosis || 'Not recorded', findings: lines(c.notes).slice(0, 4),
    plan: [c.prescription ? `Prescription: ${c.prescription}` : null, c.follow_up_date ? `Follow-up on ${c.follow_up_date}` : null].filter(Boolean),
    patient_instructions: ['Take medicines exactly as prescribed.', 'Rest and drink enough water.', 'Contact the doctor if symptoms worsen.'], follow_up: c.follow_up_date || '' };
  if (aiOn()) { try { const j = await gemini({ system: 'Write a short structured consultation summary for the patient record from the doctor\'s notes and chat. Do not invent facts. Return JSON only: {"chief_complaint":string,"diagnosis":string,"findings":string[],"plan":string[],"patient_instructions":string[],"follow_up":string}', prompt: `Patient context:\n${ctxText(rec)}\n\nDoctor notes: ${c.notes}\nDiagnosis: ${c.diagnosis}\nPrescription: ${c.prescription}\nFollow-up date: ${c.follow_up_date}\nChat:\n${msgs.filter(m => m.sender_role !== 'system').slice(-12).map(m => m.sender_role + ': ' + m.text).join('\n')}` }); return { ...fb, ...j }; } catch (e) { /* fall through */ } }
  return fb;
}
module.exports = { chat, medicineCheck, readReport, brief, consultSummary, aiOn, status, daysAgo, SPECIALTIES };
