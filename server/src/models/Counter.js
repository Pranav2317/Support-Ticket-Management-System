const mongoose = require('mongoose');

// Atomic sequence generator used for human-friendly ticket numbers (TCK-1001, ...).
// findOneAndUpdate + $inc is atomic, so concurrent requests never get the same number.
const counterSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } });

counterSchema.statics.next = async function next(name) {
  const doc = await this.findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return doc.seq;
};

module.exports = mongoose.model('Counter', counterSchema);
