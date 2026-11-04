const mongoose = require('mongoose');
const { createHash, randomUUID } = require('node:crypto');

const HOUR_MS = 60 * 60 * 1000;
const schema = new mongoose.Schema({
  // The built-in unique _id index serializes updates for each dimension/key.
  _id: String,
  attempts: { type: [Date], default: [] },
  expiresAt: Date,
  lastAdmission: { type: String, select: false },
}, { versionKey: false });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

schema.statics.consume = async function (dimension, value, limit, now) {
  const key = `${dimension}:${createHash('sha256').update(value).digest('hex')}`;
  // Initialize separately so competing first requests cannot bypass the limit.
  // A duplicate-key race means another process has already initialized it.
  try {
    await this.updateOne({ _id: key }, {
      $setOnInsert: { attempts: [], expiresAt: new Date(Date.now() + HOUR_MS) },
    }, { upsert: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  const admission = randomUUID();
  // Production uses MongoDB's clock across all application instances. Tests can
  // explicitly supply a date to exercise the exact sliding-window boundary.
  const time = now === undefined ? '$$NOW' : { $literal: now };
  const result = await this.findOneAndUpdate({ _id: key }, [
    { $set: {
      attempts: { $filter: {
        input: { $ifNull: ['$attempts', []] },
        as: 'attempt',
        cond: { $gt: ['$$attempt', { $subtract: [time, HOUR_MS] }] },
      } },
    } },
    { $set: {
      attempts: { $cond: [
        { $lt: [{ $size: '$attempts' }, limit] },
        { $concatArrays: ['$attempts', [time]] },
        '$attempts',
      ] },
      lastAdmission: { $cond: [
        { $lt: [{ $size: '$attempts' }, limit] },
        { $literal: admission },
        '$lastAdmission',
      ] },
      expiresAt: { $add: [time, HOUR_MS] },
    } },
  ], { new: true, updatePipeline: true }).select('+lastAdmission');
  // If TTL cleanup removed the document between initialization and admission,
  // fail closed. A later request can initialize a new document.
  return result !== null && result.lastAdmission === admission;
};

module.exports = mongoose.model('RecoveryLimit', schema);
