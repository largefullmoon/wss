var express = require('express');
var app = express();
var mqttHandler = require('./services/mqtt_new');

const url = require('url');
const WebSocket = require('ws');

const mongoose = require('mongoose')
const match = require('mqtt-match')
require('./lib/db');

mqttObj = [{}];
let channels = {};

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
  ws.on('message', (message) => {
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
  console.log("Server listening on port ")

  const mqttServers = await mqttServer.find();
  if (mqttServers) {
    mqttServers.forEach((server, index) => {
      console.log(server.mqtt_server)
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

      //mqttObj[index].getMessage();

    })

    mqttServers.forEach((server, index) => {
      // console.log(server._id.toString())
      console.log("mqqt servers ", mqttObj[index].id, index);
    })
  } else {
    console.log("no mqtt servers , waiting for actions  ")
  }
}
startServer()


