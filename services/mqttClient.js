var mqttHandler = require('./mqtt_new');
var mqttClient = new mqttHandler();

mqttClient.connect();
module.exports = mqttClient;