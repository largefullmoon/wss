const mongoose = require('mongoose');

const actionSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
        },
        global: {
            type: Boolean,
        },
        company_id: {
            type: mongoose.Schema.Types.ObjectId, ref: "Company",
            required: true,
        },
        targetType: {
            type: String,  // Can be 'tag', 'asset', 'zone', 'area'
            required: true,
        },
        tag_id: {
            type: String,
            default: null,
        },
        locationcondition_id: {
            type: mongoose.Schema.Types.ObjectId, ref: "Condition",
            default: null,
        },
        asset_id: {
            type: mongoose.Schema.Types.ObjectId, ref: "Asset",
            default: null,
        },
        eventType: {
            type: mongoose.Schema.Types.ObjectId, ref: "EventType",
            required: true,
        },
        executionType: {
            type: String,  // Can be 'once', 'always'
            required: true,
        },
        webHook: {
            type: Array,
            default: [],
        },
        count: {
            type: Number,
            default: null,
        },
        status: {
            type: Number,
            default: 0,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Action', actionSchema);
