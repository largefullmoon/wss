const mqtt = require('mqtt');
const Influx = require("influx");
const WebSocket = require('ws');
var MQTTPattern = require("mqtt-pattern");

var { checkEvent } = require('../controllers/EventController.js');

const influx = new Influx.InfluxDB({
  host: "185.61.139.41",
  database: "prod",
});

async function logToInflux(measurement, data, zone, tag_id, antenna_id) {
  try {
    await influx.writePoints([
      {
        measurement: measurement,
        tags: {
          tag_id: tag_id,
          antenna_id: antenna_id,
          zone: zone
        },
        fields: {
          ...data
        }
      }
    ]);
  } catch (error) {
    console.error(`Error writing to InfluxDB for measurement "${measurement}": ${error.message}`);
  }
}
class ProcessingBuffer {
  constructor(size) {
    this.size = size;
    this.buffer = [];
    this.index = 0;
    this.lastAddedIndex = -1;
  }

  add(item) {
    if (this.buffer.length >= this.size) {
      this.buffer.shift(); // Remove the oldest item
    }
    this.buffer.push(item); // Add the new item
  }
  getBuffer() {
    return this.buffer;
  }
  getLast() {
    if (this.lastAddedIndex === -1) {
      return null; // Buffer is empty
    }
    return this.buffer[this.lastAddedIndex];
  }
  getFirst() {
    if (this.buffer.length === 0) {
      return null; // Buffer is empty
    }
    for (let i = 0; i < this.buffer.length; i++) {
      if (this.buffer[i] !== null && this.buffer[i] !== undefined) {
        const firstElement = this.buffer[i];
        this.buffer[i] = null; // Remove the element by setting it to null
        return firstElement;
      }
    }

    return null; // All elements are null or undefined
  }
}

class TagBuffer {
  constructor(size = 1) {
    this.size = size;
    this.buffer = [];
  }
  add(item) {
    // Ensure the buffer holds only the last 'size' elements
    if (this.buffer.length >= this.size) {
      this.buffer.shift();
    }
    this.buffer.push(item);
  }
  getBuffer() {
    return this.buffer;
  }
  getLast() {
    return this.buffer[this.buffer.length - 1] || null;
  }
}



class MqttHandler {
  constructor(mqtt_server, mqtt_username, mqtt_password, angle_topic, manuf_topic, position_topic, zone_id, handler_id) {
    this.mqttClient = null;
    this.host = mqtt_server;
    this.mqtt_options = {
      username: mqtt_username,
      password: mqtt_password,
      clean: true,
      connectTimeout: 4000,
      reconnectPeriod: 1000,
      keepalive: 10
    }
    this.username = mqtt_username;
    this.password = mqtt_password;
    this.angle_topic = angle_topic;
    this.manuf_topic = manuf_topic;
    this.position_topic = position_topic;
    this.zone_id = zone_id;
    this.id = handler_id;
    this.loopActive = true;
    // data what need to check on checkTag for events and notifications
    this.manuf_data = []
    this.position_data = []
    this.aoa_data = []
    this.buffers = {}; // Stores rolling buffers for each antenna's tagId
    this.previousData = {}; // Stores previous data for each antenna
    this.bufferSize = 16; // Fixed size for the rolling buffer

    this.data_types = ["manuf_data", "aoa_data", "position_data"]
    this.data_types.forEach(data_type => {
      this.buffers[data_type] = []
      this.previousData[data_type] = []
    });
  }

  async runTask() {
    while (this.loopActive) {
      await this.processBuffers("manuf_data");
      await this.processBuffers("position_data")
      await this.wait(100); // slowmo
    }
  }
  processMessage(parsedData, type, tagId) {
    try {
      //console.log(`Received data for tag ${tagId} on topic ${topic}:`, parsedData);

      if (!this.previousData[type][tagId]) {
        this.previousData[type][tagId] = new TagBuffer()
      }

      if (!this.buffers[type][tagId]) {
        this.buffers[type][tagId] = new ProcessingBuffer(this.bufferSize);
      }
      const lastDataString = JSON.stringify(this.previousData[type][tagId].getLast());
      const parsedDataString = JSON.stringify(parsedData);

      if (lastDataString !== parsedDataString) {
        this.buffers[type][tagId].add(parsedData);
        this.previousData[type][tagId].add(parsedData);
        // console.log(`Data for tag ${tagId} changed, added to buffer. Buffer:`, parsedData, this.buffers[type][tagId].getBuffer());
      } else {
        // console.log(`Data for tag ${tagId} did not change`);
      }
    } catch (error) {
      console.error(`Failed to process data from ${topic}`, error);
    }
  }


  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }


  go() {
    const tag_ids = []

    var wscon
    const connectWebSocket = () => {
      wscon = new WebSocket("ws://localhost:8080/" + this.zone_id);

      // Add event listeners for reconnection
      wscon.onclose = () => {
        console.log('WebSocket closed. Attempting reconnect...');
        setTimeout(connectWebSocket, 3000); // Reconnect after 3 seconds
      };

      wscon.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    };
    // Initial connection
    connectWebSocket();
    var anglePattern = this.angle_topic.slice(0, -1) + "+antenna_id/+tag_id";
    var manufPattern = this.manuf_topic.slice(0, -1) + "+antenna_id/+tag_id";
    var positionPattern = this.position_topic.slice(0, -1) + "+location/+tag_id";

    if (this.host.indexOf("127.0.0.1") >= 0 || this.host.indexOf("localhost") >= 0) {
      return false
    }

    this.mqttClient = mqtt.connect('mqtt://' + this.host, this.mqtt_options);
    this.mqttClient.on('error', (err) => {
      this.mqttClient.reconnect();
    });
    this.mqttClient.on('connect', () => {
      this.mqttClient.subscribe(this.angle_topic);
      this.mqttClient.subscribe(this.manuf_topic);
      this.mqttClient.subscribe(this.position_topic);
    });



    this.mqttClient.on("message", async (topic, message) => {
      var paramsAngle = MQTTPattern.exec(anglePattern, topic)
      if (paramsAngle) {
        const type = "aoa_data"
        const data = JSON.parse(message.toString());
        let wsmessage = {
          ...data,
          tag_id: paramsAngle.tag_id,
          "type": type
        }
        // Check connection state before sending
        if (wscon.readyState !== WebSocket.OPEN) {
          console.log('WebSocket not open. Reconnecting...');
          connectWebSocket();

          // Wait for connection to open
          await new Promise(resolve => {
            wscon.onopen = () => {
              resolve();
            };
          });
        }
        wscon.send(JSON.stringify(wsmessage).toString());
        // this.processMessage(data, type, paramsAngle.tag_id)

        logToInflux("aoa", data, this.zone_id, paramsAngle.tag_id, paramsAngle.antenna_id)


      } else {
        var paramsManuf = MQTTPattern.exec(manufPattern, topic)
        if (paramsManuf) {
          const data = JSON.parse(message.toString());
          const type = "manuf_data";
          let wsmessage = {
            ...data,
            tag_id: paramsManuf.tag_id,
            "type": type
          }
          // Check connection state before sending
          if (wscon.readyState !== WebSocket.OPEN) {
            console.log('WebSocket not open. Reconnecting...');
            connectWebSocket();

            // Wait for connection to open
            await new Promise(resolve => {
              wscon.onopen = () => {
                resolve();
              };
            });
          }
          wscon.send(JSON.stringify(wsmessage).toString());
          this.processMessage(data, type, paramsManuf.tag_id);
          logToInflux("manuf_data", data, this.zone_id, paramsManuf.tag_id, paramsManuf.antenna_id)
        } else {
          var paramsPosition = MQTTPattern.exec(positionPattern, topic)
          if (paramsPosition) {
            const type = "position_data"
            const data = JSON.parse(message.toString());
            let wsmessage = {
              ...data,
              tag_id: paramsPosition.tag_id,
              'location': paramsPosition.location,
              "type": type
            }
            // Check connection state before sending
            if (wscon.readyState !== WebSocket.OPEN) {
              console.log('WebSocket not open. Reconnecting...');
              connectWebSocket();

              // Wait for connection to open
              await new Promise(resolve => {
                wscon.onopen = () => {
                  resolve();
                };
              });
            }
            wscon.send(JSON.stringify(wsmessage).toString());
            this.processMessage(data, type, paramsPosition.tag_id)

            logToInflux("position", data, this.zone_id, paramsPosition.tag_id, paramsPosition.antenna_id)
          }
        }

      }
    })

  }
  async processBuffers(type) {
    const keys = Object.keys(this.buffers[type]);
    keys.forEach((key) => {
      const msg = this.buffers[type][key].getFirst()
      if (msg != null) {
        // console.log(`Processing ${type} buffer for tagId: ${key}`);
        checkEvent(JSON.stringify(msg), this.zone_id, type, key);
      }
    });
  }

  stop() {
    if (this.mqttClient) {
      this.mqttClient.end(true, () => {
        console.log('MQTT client disconnected successfully.');
      });
    }
    if (this.wscon) {
      this.wscon.close(() => {
        console.log('WebSocket connection closed.');
      });
    }
  }
  getMessage() {
    this.mqttClient.on("message", (topic, message) => {
      console.log(`Received message on topic '${topic}': ${message}`);
    })
  }

}

module.exports = MqttHandler;