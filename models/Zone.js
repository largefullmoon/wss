const mongoose = require('mongoose');

const zoneSchema = new mongoose.Schema(
  {
    title: {
      type: String, required: true, unique: true
    },
    desc: {
      type: String, default: null
    },
    status: {
      type: Number, default: 0
    },
    company: {
      type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true
    },
    mqttServer_id: {
      type: String, default: null
    },
    isDeleted: {
      type: Boolean, default: false
    }
  }
);

module.exports = mongoose.model('Zone', zoneSchema);
