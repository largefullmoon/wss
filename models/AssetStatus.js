const mongoose = require('mongoose');

const assetstatusSchema = new mongoose.Schema(
  {
    asset_id: {
      type: mongoose.Schema.Types.ObjectId, ref: 'Asset'
    },
    tag_id: {
      type: String, default: null
    },
    zone_id: {
      type: mongoose.Schema.Types.ObjectId, ref: 'Zone'
    },
    movement_status: {
      type: String, default: null
    },
    startTime: {
      type: Date
    },
    stopTime: {
      type: Date
    },
  }
);

module.exports = mongoose.model('AssetStatus', assetstatusSchema);
