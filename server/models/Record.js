const mongoose = require('mongoose');
const learningSchema = new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }, title: String, transcript: String, sourceType: String, sourceUrl: String, sourceMetadata: mongoose.Schema.Types.Mixed, sourceLanguage: String, outputLanguage: String, topicName: String, generationMode: String, fallbackLabel: String, titlePracticeLabel: String, summary: String, explanation: String, notes: [String], keyPoints: [String], revisionPoints: [String], examples: [Object], questions: [String], answers: [String], quiz: [Object], flashcards: [Object], chatHistory: [Object], finalizedAt: Date, createdAt: { type: Date, default: Date.now } });
const interviewSchema = new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }, role: String, topic: String, difficulty: String, voiceMode: { type: Boolean, default: false }, questions: [Object], answers: [String], answerEvaluations: [Object], voiceEvaluations: [Object], report: Object, createdAt: { type: Date, default: Date.now } });
const userSchema = new mongoose.Schema({ name: { type: String, required: true, trim: true }, email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true }, passwordHash: { type: String, required: true, select: false }, phone: { type: String, default: '' }, collegeName: { type: String, default: '' }, profileComplete: { type: Boolean, default: false }, settings: { outputLanguage: { type: String, default: 'English' } } }, { timestamps: true });
module.exports = {
  Learning: mongoose.models.Learning || mongoose.model('Learning', learningSchema),
  Interview: mongoose.models.Interview || mongoose.model('Interview', interviewSchema),
  User: mongoose.models.User || mongoose.model('User', userSchema),
};

