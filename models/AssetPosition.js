const mongoose = require('mongoose');

const assetpositionSchema = new mongoose.Schema(
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
    area_id: {
      type: mongoose.Schema.Types.ObjectId, ref: 'Area'
    },
    enterTime: {
      type: Date
    },
    exitTime: {
      type: Date
    }
  }
);

module.exports = mongoose.model('AssetPosition', assetpositionSchema);
