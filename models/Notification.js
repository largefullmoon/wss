const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    tag_id: {
      type: String,
      default: null,
    },
    zone_id: {
      type: mongoose.Schema.Types.ObjectId, ref: "Zone",
      default: null,
    },
    message: {
      type: String,
      default: null,
    },
    header: {
      type: String,
      default: null,
    },
    readUserIds: {
      type: Array,
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);