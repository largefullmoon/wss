var express = require('express');
var app = express();
var mqttHandler = require('./services/mqtt_new');
var { checkEvent } = require('./controllers/EventController.js');
const Area = require('./models/Area');
const Map = require('./models/Map');
const url = require('url');
const WebSocket = require('ws');
const mongoose = require('mongoose')
const match = require('mqtt-match')
require('./lib/db');

mqttObj = [{}];
let channels = {};
let areas = {}
const mqttServer = require('./models/Mqtt');

const zoneController = require('./controllers/ZoneController.js');
app.use('/api', zoneController);

const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws, req) => {
  const channel = req.url.substring(1);
  console.log("connected to ws ")
  if (!channels[channel]) {
    channels[channel] = [];
  }
  channels[channel].push(ws);
  ws.on('message', async (message) => {
    await checkEvent(message.toString(), channel, areas[channel], ws)
    channels[channel].forEach(function each(client) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message.toString());
      }
    });
  });

  ws.on('close', () => {
    channels[channel] = channels[channel].filter((client) => client !== ws);
  });
});

async function startServer() {

  const wsserver = app.listen(8000)

  const mqttServers = await mqttServer.find();
  if (mqttServers) {
    mqttServers.forEach((server, index) => {
      mqttObj.push(server._id.toString());
      mqttObj[index] = new mqttHandler(server.mqtt_server,
        server.mqtt_username,
        server.mqtt_password,
        server.angle_topic,
        server.manuf_topic,
        server.position_topic,
        server.zone.toString(),
        server._id.toString(),
      );
      mqttObj[index].go();
    })

    mqttServers.forEach((server, index) => {
      console.log("mqqt servers ", mqttObj[index].id, index);
    })
  } else {
    console.log("no mqtt servers , waiting for actions  ")
  }
}
startServer()


app.post('/api/refresh/:id', async (req, res) => {
  const channel =  req.params.id
  const map = await Map.findOne({ zone: channel })
  const area = await Area.find({ map: map._id })
  areas[channel] = area
});