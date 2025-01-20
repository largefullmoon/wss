const mongoose = require('mongoose');

const WebHookSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, default: null },
    type: { type: String, default: null },
    webhookUrl: { type: String, default: null },
    email: { type: String, default: null },
    failcount: { type: Number, default: 0 },
    sentcount: { type: Number, default: 0 },
    message: { type: String, default: null },
    params: [{ type: Object, default: null }],
    URLParams: [{ type: Boolean, default: false }],
});

module.exports = mongoose.model('webHook', WebHookSchema);