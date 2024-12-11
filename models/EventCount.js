const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    zone: {
      type: String, required: true, unique: true
    },
    category: {
      type: String, default: null
    },
    datetime: {
      type: String
    },
    count: {
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

module.exports = mongoose.model('EventCount', schema);
