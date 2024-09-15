const express = require('express');
const router = express.Router();
const Zone = require('../models/Zone');
const mqttServer = require('../models/Mqtt');
var mqttHandler = require('../services/mqtt_new');

// Get all products
router.get('/mqtt', async (req, res) => {
  console.log("web request mqtt")
  try {
    const mqttServers = await mqttServer.find();
    res.json(mqttServers);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/mqtt/:id', async (req, res) => {
  try {
    const mqttSrv = await mqttServer.findById(req.params.id);
    if (!mqttSrv) {
      return res.status(404).json({ error: 'Mqtt not found' });
    }
    res.json(mqttSrv);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/mqtt/start/:id', async (req, res) => {
  try {
    const id = req.params.id
    console.log("req id ", id)
    var result = mqttObj.find(obj =>
      obj.id === id
    )
    if (result) {
      return res.status(200).json({ status: "running" });
    }
    const mqttSrv = await mqttServer.findById(id);
    console.log("after result", mqttSrv)
    if (!mqttSrv) {
      return res.status(404).json({ status: 'not found' });
    }
    mqttObj.push(mqttSrv._id.toString());
    mqttObj[mqttObj.length - 1] = new mqttHandler(mqttSrv.mqtt_server,
      mqttSrv.mqtt_username,
      mqttSrv.mqtt_password,
      mqttSrv.angle_topic,
      mqttSrv.manuf_topic,
      mqttSrv.position_topic,
      mqttSrv.zone.toString(),
      mqttSrv._id.toString(),
    );
    mqttObj[mqttObj.length - 1].go()
    res.json({ status: "ok" });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});
// Stop mqttInstance
router.post('/mqtt/stop/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const mqttInstance = mqttObj.find(obj => obj.id === id);
    if (!mqttInstance) {
      return res.status(404).json({ error: 'MQTT instance not found' });
    }
    mqttInstance.stop();
    mqttObj = mqttObj.filter(obj => obj.id !== id);
    res.json({ status: 'MQTT instance stopped successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add a new MQTT server
router.post('/addmqtt', async (req, res) => {
  try {
    if (mqttObj.length > 0) {
      const mqttInstance = mqttObj[mqttObj.length - 1]
      if (mqttInstance) {
        mqttInstance.stop();
      }
    }
    const { mqtt_server, mqtt_username, mqtt_password, angle_topic, manuf_topic, position_topic, zone } = req.body;
    const newMqttServer = new mqttServer({
      mqtt_server,
      mqtt_username,
      mqtt_password,
      angle_topic,
      manuf_topic,
      position_topic,
      zone
    });
    await newMqttServer.save();
    res.status(201).json({
      message: 'MQTT server created successfully',
      id: newMqttServer._id, // Return the ID
      mqttServer: newMqttServer
    });
  } catch (error) {

    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete an MQTT server
router.post('/removemqtt/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedMqttServer = await mqttServer.findByIdAndDelete(id);
    if (!deletedMqttServer) {
      return res.status(404).json({ error: 'MQTT server not found' });
    }
    res.json({ message: 'MQTT server deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;