const mongoose = require('mongoose');
const { Schema, Types, model, models } = mongoose;

const conditionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
    },
    company_id: {
      type: String,
    },
    conditions: {
      type: Array,
      default: []
    },
    type: {
      type: String,
    },
  },
  { timestamps: true }
);

const Condition = models?.Condition || model('Condition', conditionSchema);

module.exports = { Condition };
