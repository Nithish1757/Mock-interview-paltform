const test = require('node:test');
const assert = require('node:assert/strict');
const { topicNames, INTERVIEW_QUESTION_COUNT, buildQuestions, evaluateAnswer } = require('./interviewBank');

test('every published interview topic provides fifteen questions', () => {
  assert.ok(topicNames.length > 0);
  for (const topic of topicNames) {
    const questions = buildQuestions(topic, 'Intermediate');
    assert.equal(questions.length, INTERVIEW_QUESTION_COUNT, topic);
    assert.equal(questions.filter(question => question.type === 'Technical').length, 9, topic);
    assert.equal(questions.filter(question => question.type === 'Scenario').length, 3, topic);
    assert.equal(questions.filter(question => question.type === 'Behavioral').length, 3, topic);
    assert.ok(questions.every(question => question.question && question.expectedAnswer));
  }
});

test('reference answer evidence receives an evaluated score', () => {
  const question = buildQuestions('JavaScript', 'Intermediate')[0];
  const result = evaluateAnswer(question, question.expectedAnswer);
  assert.equal(result.status, 'evaluated');
  assert.ok(result.score >= 90);
  assert.equal(result.answer, question.expectedAnswer);
});

test('partial answer identifies missing reference criteria', () => {
  const question = buildQuestions('JavaScript', 'Intermediate')[0];
  const result = evaluateAnswer(question, 'Synchronous code runs on the call stack.');
  assert.equal(result.status, 'evaluated');
  assert.ok(result.score < 90);
  assert.ok(result.missingConcepts.length > 0);
});

test('irrelevant and empty answers do not receive invented scores', () => {
  const question = buildQuestions('JavaScript', 'Intermediate')[0];
  for (const answer of ['banana chair sky blue', '']) {
    const result = evaluateAnswer(question, answer);
    assert.equal(result.status, 'needs-manual-review');
    assert.equal(result.score, null);
  }
});
