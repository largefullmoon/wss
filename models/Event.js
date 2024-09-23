const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            required: true,
        },
        object: {
            type: String,
            required: true,
        },
        zone: {
            type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Zone' }],
            default: [],
        },
        area: {
            type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Area' }],
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
