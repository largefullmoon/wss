const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    zone: {
      type: String, required: true
    },
    category: {
      type: String, default: null
    },
    datetime: {
      type: Date
    },
    count: {
      type: Number, default: 0
    },
    info: {
      type: Number, default: 0
    },
    warning: {
      type: Number, default: 0
    },
    error: {
      type: Number, default: 0
    },
    critical: {
      type: Number, default: 0
    },
    ongoing: {
      type: Number, default: 0
    },
    resolved: {
      type: Number, default: 0
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AssetEventCount', schema);
