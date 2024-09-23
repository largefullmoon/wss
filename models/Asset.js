const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema(
    {
      title: {
        type: String,
        required: true,
      },
      desc: {
        type: String,
        required: true,
      },
      serial: {
        type: String,
        unique: true,
      },
      tag: {
        type: String,
        default: null,
      },
      img: {
        type: String,
        default: null,
      },
      group: {
        type: String,
        default: null,
      },
      color: {
        type: String, // You can store RGB color codes as strings like "rgb(255, 0, 0)"
        default: function () {
          const colors = [
            'rgb(255, 0, 0)',
            'rgb(0, 255, 0)',
            'rgb(0, 0, 255)',
            // Add more colors if needed
          ];
          return colors[Math.floor(Math.random() * colors.length)];
        },
      },
      dimensions: {
        width: {
          type: Number,
          default: 5,
          min: 1,
        },
        length: {
          type: Number,
          default: 5,
          min: 1,
        },
        height: {
          type: Number,
          default: 5,
          min: 1,
        },
      },
      hideFromMap: {
        type: Number, // 0 for disabled, 1 for enabled
        default: 0,
      },
      description: {
        type: String,
        default: '',
      },
    },
    { timestamps: true }
  );

module.exports = mongoose.model('Asset', assetSchema);
