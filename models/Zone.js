const mongoose = require('mongoose');

const zoneSchema = new mongoose.Schema(
    {
      title: {
        type: String,
        require: true,
        unique: true
      },
      desc: {
        type: String,
        default: null,
      },
      status: {
        type: Number,
        default: 0,
      },
   
    },
      { timestamps: true }
  );

  module.exports = mongoose.model('Zone', zoneSchema);
