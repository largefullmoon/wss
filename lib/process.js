const mqtt = require('mqtt')

const mongoose = require('mongoose')
const match = require('mqtt-match')
const WebSocket = require('ws');
const mqttServer = require('../models/Mqtt');


const mqttServers = await mqttServer.find();
console.log(mqttServers)
const wss = new WebSocket.Server({ port: 8080 });

let wsmessage = "";

  const clientId = `node_${Math.random().toString(16).slice(3)}`
    const client = mqtt.connect(mqttServer, {
        clientId,
        clean: true,
        connectTimeout: 4000,
        reconnectPeriod: 1000,
      })
      client.on('connect', () => {
        client.subscribe([topic], () => {
       //   console.log(`Subscribe to topic '${topic}'`)
        })
      })
    
      client.on('error', () => {
        console.log('ERROR:', error)
      })
      client.on("message", (topic, message) => {
        const data = JSON.parse(message);
        console.log(message);
        //const devId='ble-pd-0C4314F459BA';
       // const t = match('silabs/aoa/+/+/+', 'silabs/aoa/position/filtered-position/' + devId)
        if (t) {
	  //wsmessage="ble-pd-0C4314F459BA" + data.x + " " + " " + data.y + " " + data.z
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data.toString());
      }
  });
        }
       // const r = match('silabs/aoa/+/+/+', 'silabs/aoa/position/positioning-test_room/ble-pd-0C4314F46166')

      console.log(`Received message on topic: ${topic}: ${data.x}  `);

        // Parse the message payload as JSON
    })  

    wss.on('connection', (ws) => {
      console.log('A new client connected.');
    
      // Event listener for incoming messages
      // Event listener for client disconnection
      ws.on('close', () => {
        console.log('A client disconnected.');
      });
    });

app.ws('/', function(ws, req) {
  ws.on('message', function(msg) {
    console.log(msg);
  });
  ws.on('open', function open() {
  ws.send(message);
 });

  console.log('socket', req.testing);
});