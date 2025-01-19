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
const Influx = require("influx");
const fs = require('fs');
const https = require('https');
const TagStatus = require('./models/TagStatus.js');
const influx = new Influx.InfluxDB({
  host: "185.61.139.41",
  database: "prod",
});
mqttObj = [{}];
let channels = {};
let areas = {}
const mqttServer = require('./models/Mqtt');

const zoneController = require('./controllers/ZoneController.js');
app.use('/api', zoneController);

// const serverOptions = {
//   cert: fs.readFileSync('/etc/nginx/ssl/cotrax.io.crt'),    // Path to SSL certificate
//   key: fs.readFileSync('/etc/nginx/ssl/cotrax.io.key'),  // Path to private key
// };
// const httpsServer = https.createServer(serverOptions);

const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws, req) => {
  const channel = req.url.substring(1);
  console.log("connected to ws ")
  if (!channels[channel]) {
    channels[channel] = [];
  }
  channels[channel].push(ws);
  ws.on('message', async (message) => {
    const tagInfos = JSON.parse(message.toString())
    if (tagInfos.type == "position_data") {
      channels[channel].forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message.toString());
        }
      });
    }
    await checkEvent(message.toString(), channel, areas[channel], ws)
  });

  ws.on('close', () => {
    channels[channel] = channels[channel].filter((client) => client !== ws);
  });
});

/**
 * Start the server and connect to the MQTT servers defined in the database.
 * Once connected, start the MQTT handlers and print the MQTT server ids and their corresponding index.
 * If no MQTT servers are found in the database, print a message and wait for actions.
 */
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
app.get('/api/refresh/:id', async (req, res) => {
  const channel = req.params.id
  console.log(channel, "zone_id")
  const map = await Map.findOne({ zone: channel })
  if (map) {
    const area = await Area.find({ map: map._id })
    areas[channel] = area
  } else {
    areas[channel] = []
  }
  res.json({ status: "ok" });
});
async function getAllTagData() {
  // Query to retrieve data from the `manuf_data` measurement based on tag values
  const query = `
    SELECT LAST(ext_adc), *
      FROM "manuf_data"
      GROUP BY "tag_id"
    `;

  influx.query(query)
    .then(async (rows) => {
      if (rows.length > 0) {
        rows.forEach(async (row) => {
          const tag = await TagStatus.findOne({ tag_id: row.tag_id });
          const queryPosition = `
            SELECT LAST(x), *
              FROM "position"
              Where tag_id='`+ row.tag_id + `'
              GROUP BY "tag_id"
            `;
          let position_data = {}
          influx.query(queryPosition)
            .then(async (position_rows) => {
              if (position_rows.length > 0) {
                position_rows.forEach(async (position_row) => {
                  position_data = {
                    x: position_row.x,
                    y: position_row.y,
                    z: position_row.z
                  }
                })
              }
            })
          console.log(position_data, "position_data")
          if (tag) {
            // Tag exists, update it
            tag.time = row.time._nanoISO
            tag.position = position_data
            await tag.save();
          } else {
            // Tag does not exist, create a new one
            const newTag = new TagStatus({
              tag_id: row.tag_id,
              zone_id: row.zone,
              time: row.time._nanoISO,
              position: position_data,
              status: "no data",
            });
            await newTag.save();
          }
        })
      } else {
        console.log('No data found for the given query.');
      }
    })
    .catch((err) => {
      console.error(`Error querying data from InfluxDB: ${err}`);
    });
}
getAllTagData()
