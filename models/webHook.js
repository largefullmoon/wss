const mongoose = require('mongoose');

const WebHookSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, default: null },
    type: { type: String, default: null },
    webhookUrl: { type: String, default: null },
    email: { type: String, default: null },
    message: { type: String, default: null },
    params: [{ type: Object, default: null }],
});

module.exports = mongoose.model('webHook', WebHookSchema);