const test = require('node:test');
const assert = require('node:assert/strict');
const { parseVtt, parseWhisperResult, splitTranscript, renderTranscript, timeLabel, supportedLanguages } = require('./videoLearning');

test('language options cover all multilingual whisper.cpp languages', () => {
  assert.equal(supportedLanguages.length, 100);
  assert.equal(new Set(supportedLanguages.map(item => item.code)).size, 100);
  for (const language of ['English', 'Kannada', 'Hindi', 'Telugu', 'Tamil', 'Malayalam', 'Marathi', 'Bengali', 'Urdu', 'Sundanese', 'Cantonese']) {
    assert.ok(supportedLanguages.some(item => item.name === language), `${language} should be selectable`);
  }
});

test('YouTube WebVTT captions retain timestamps and readable cue text', () => {
  const segments = parseVtt('WEBVTT\n\n00:00:02.000 --> 00:00:04.000\nHello <i>world</i>.\n\n00:01:03.000 --> 00:01:05.000\nSecond cue.');
  assert.deepEqual(segments.map(item => item.text), ['Hello world.', 'Second cue.']);
  assert.deepEqual(segments.map(item => timeLabel(item.start)), ['00:02', '01:03']);
  assert.match(renderTranscript(segments), /^\[00:02\] Hello world\./);
});

test('whisper.cpp JSON segments keep timestamps, chunk offsets, and detected language', () => {
  const parsed = parseWhisperResult({
    result: { language: 'english' },
    transcription: [{ timestamps: { from: '00:00:02,500', to: '00:00:04,000' }, text: '  A spoken sentence. ' }],
  }, 600);
  assert.equal(parsed.detectedLanguage, 'English');
  assert.deepEqual(parsed.segments, [{ start: 602.5, end: 604, text: 'A spoken sentence.' }]);
});

test('long transcript splitting preserves every character without overflow', () => {
  const source = 'first block\n'.repeat(30) + 'final';
  const chunks = splitTranscript(source, 48);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every(chunk => chunk.length <= 48));
  assert.equal(chunks.join('\n'), source);
});

test('pasted transcript content is not given invented timestamp markers', () => {
  assert.equal(renderTranscript([{ text: 'spoken words' }, { text: 'later words' }]), 'spoken words\nlater words');
});
