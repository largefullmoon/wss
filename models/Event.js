const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
    {
        category: {
            type: String,
        },
        type: {
            type: String,
            required: true,
        },
        object: {
            type: String,
            required: true,
        },
        zone: {
            type: mongoose.Schema.Types.ObjectId, ref: "Zone",
            default: [],
        },
        area: {
            type: mongoose.Schema.Types.ObjectId, ref: "Area",
            default: null,
        },
        battery_status: {
            type: String,
            default: null,
        },
        information: {
            type: String,
            default: null,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Event', eventSchema);
