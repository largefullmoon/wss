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
    readUserIds: {
      type: Array,
      default: [],
    },
  },
  { timestamps: true }
);

const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);

export default Notification;