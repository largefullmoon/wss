const mongoose = require('mongoose');

const eventTypeSchema = new mongoose.Schema(
    {
        category: {
            type: String,
            required: true,
        },
        name: {
            type: String,
            required: true,
        },
        condition: {
            type: Object,
            default: null,
        },
        standard_value: {
            type: String,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('EventType', eventTypeSchema);
