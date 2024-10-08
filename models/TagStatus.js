const mongoose = require('mongoose');

const tagSchema = new mongoose.Schema(
    {
        tag_id: {
            type: String,
            require: true
        },
        zone_id: {
            type: mongoose.Schema.Types.ObjectId, ref: "Zone",
            default: null,
        },
        manuf_data: {
            type: Object,
            default: null,
        },
        status: {
            type: String,
            default: null,
        },
        time: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('TagStatus', tagSchema);

