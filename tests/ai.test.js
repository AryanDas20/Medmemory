'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const ai = require('../server/ai');

const emptyRecord = () => ({
  user: { id: 'test-patient', name: 'Test Patient', email: 'patient@example.test' },
  profile: { age: 32, gender: 'female', blood_group: 'B+' },
  history: [], allergies: [], medications: [], symptoms: [], reports: [], trends: []
});

test('medicine context flags a recorded penicillin allergy', () => {
  const record = emptyRecord();
  record.allergies.push({ allergen: 'penicillin', severity: 'severe', reaction: 'breathing difficulty' });
  const result = ai.medicineCheck('amoxicillin', record);
  assert.equal(result.verdict, 'avoid');
  assert.match(result.reasons.join(' '), /allerg/i);
});

test('medicine context warns about selected condition conflicts', () => {
  const record = emptyRecord();
  record.history.push({ name: 'Asthma', status: 'active' });
  const result = ai.medicineCheck('ibuprofen', record);
  assert.equal(result.verdict, 'caution');
  assert.match(result.reasons.join(' '), /asthma/i);
});

test('report text parser identifies an out-of-range HbA1c value', async () => {
  const result = await ai.readReport({ text: 'HbA1c: 7.2 % (4.0-5.6)\nFasting blood sugar: 90 mg/dL (70-100)' });
  const hba1c = result.values.find(v => /hba1c/i.test(v.test_name));
  assert.ok(hba1c, 'HbA1c value should be extracted');
  assert.equal(hba1c.status, 'high');
});

test('urgent symptom phrases set the emergency flag', async () => {
  const result = await ai.chat('I have chest pain and sweating. I cannot breathe properly.', emptyRecord(), []);
  assert.equal(result.meta.red_flag, true);
  assert.equal(result.meta.urgency, 'emergency');
  assert.equal(typeof result.meta.red_flag_reason, 'string');
});

test('health guide returns a rules response when the Gemini key is unavailable', async () => {
  const previousGemini = process.env.GEMINI_API_KEY;
  const previousGoogle = process.env.GOOGLE_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_API_KEY;
  try {
    const result = await ai.chat('I have been feeling unwell. What details should I track?', emptyRecord(), []);
    assert.ok(result.content.length > 0, 'The guide should always return a helpful fallback response');
    assert.equal(result.meta.engine, 'rules');
    assert.ok(Array.isArray(result.meta.follow_up_questions));
    assert.equal(Object.hasOwn(result.meta, 'red_flag_reason'), false, 'non-emergency metadata must omit the optional reason');
    assert.equal(result.meta.fallback, true, 'rule-based responses must be identified as a fallback');
  } finally {
    if (previousGemini === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousGemini;
    if (previousGoogle === undefined) delete process.env.GOOGLE_API_KEY;
    else process.env.GOOGLE_API_KEY = previousGoogle;
  }
});
