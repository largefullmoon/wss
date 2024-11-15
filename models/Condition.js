const mongoose = require('mongoose');
const { Schema, Types, model, models } = mongoose;

const conditionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
    },
    category: {
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
    message: {
      type: String,
    },
    checkingType: {
      type: String,
    },
    checkingPeriod: {
      type: String,
    },
    severity: {
      type: String,
    }
  },
  { timestamps: true }
);

const Condition = models?.Condition || model('Condition', conditionSchema);

module.exports = { Condition };
