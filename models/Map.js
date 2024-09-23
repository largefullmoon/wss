const mongoose = require('mongoose');

const mapSchema = new mongoose.Schema({
    title: {
        type: String,
        default: null,
    },
    url: {
        type: String,
        required: true,
        unique: true,
    },
    filename: {
        type: String,
    },
    pos: {
        type: Object,
        default: { x: 0, y: 0 },
    },
    areas: {
        type: Object,
        default: [],
    },
    zone: {
        type: mongoose.Schema.Types.ObjectId, ref: "Zone",
        default: null,
    },
},
    { timestamps: true }
);

module.exports = mongoose.model('Map', mapSchema);
