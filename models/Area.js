const mongoose = require('mongoose');

const areaSchema = new mongoose.Schema({
    map: {
        type: mongoose.Schema.Types.ObjectId, ref: "Map",
        default: null,
    },
    position: {
        type: Object,
        default: { x: 0, y: 0 },
    },
    width: {
        type: String,
    },
    height: {
        type: String,

    },
    bottom_left: {
        type: Object,
        default: { x: 0, y: 0 },
    },
    top_right: {
        type: Object,
        default: { x: 0, y: 0 },
    },
},
    { timestamps: true }
);

module.exports = mongoose.model('Area', areaSchema);
