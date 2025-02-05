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
        previous_zone_id: {
            type: mongoose.Schema.Types.ObjectId, ref: "Zone",
            default: null,
        },
        area_id: {
            type: String,
            default: null,
        },
        enterOrExit: {
            type: String,
            default: null,
        },
        enterOrExitTime: {
            type: String,
            default: null,
        },
        manuf_data: {
            type: Object,
            default: null,
        },
        previous_aoa: {
            type: Object,
            default: null,
        },
        previous_position: {
            type: Object,
            default: null,
        },
        previous_manuf_data: {
            type: Object,
            default: null,
        },
        aoa: {
            type: Object,
            default: null,
        },
        position: {
            type: Object,
            default: null,
        },
        status: {
            type: String,
            default: null,
        },
        runConditions: {
            type: Object,
            default: [],
        },
        ongoingEvents: {
            type: Object,
            default: [],
        },
        time: {
            type: Date,
            default: null,
        },
        battery_status: {
            type: String,
            default: null,
        },
        is_new: {
            type: Boolean,
            default: false,
        },
        isCheckingAOA: {
            type: Boolean,
            default: false,
        },
        isCheckingPosition: {
            type: Boolean,
            default: false,
        },
        isCheckingManuf: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('TagStatus', tagSchema);

