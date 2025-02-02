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
    tag_id: {
      type: String,
      default: null
    },
    conditions: {
      type: Array,
      default: []
    },
    type: {
      type: String,
    },
    severity: {
      type: String,
    },
    description: {
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
    },
    selectedZones: {
      type: Array,
      default: []
    },
    selectedAreas: {
      type: Array,
      default: []
    },
    start: {
      type: String,
      default: null
    },
    end: {
      type: String,
      default: null
    },
  },
  { timestamps: true }
);

const Condition = models?.Condition || model('Condition', conditionSchema);

module.exports = { Condition };
