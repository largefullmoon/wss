const mqtt = require('mqtt');
const Influx = require("influx");
const WebSocket = require('ws');
var MQTTPattern = require("mqtt-pattern");
const TagStatus = require('../models/TagStatus');
const influx = new Influx.InfluxDB({
  host: "185.61.139.41",
  database: "prod",
});

async function outPut(topic, message) {
  console.log(`Received message on topic '${topic}': ${message}`);

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
  }

  go() {
    const tag_ids = []
    // var wscon = new WebSocket("wss://websocket.cotrax.io:8443/" + this.zone_id);
    var wscon = new WebSocket("ws://localhost:8080/" + this.zone_id);

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
        const data = JSON.parse(message.toString());
        let wsmessage = {
          ...data,
          tag_id: paramsAngle.tag_id,
          "type": "aoa_data"
        }
        wscon.send(JSON.stringify(wsmessage).toString());
        influx
          .writePoints([
            {
              measurement: "aoa",
              tags: {
                tag_id: paramsAngle.tag_id,
                antenna_id: paramsAngle.antenna_id,
                zone: this.zone_id
              },
              fields: {
                ...data
              },
              timestamp: data.timestamp,
            },
          ])
          .then(() => {
          })
          .catch((err) => {
            console.error(`Error writing data to InfluxDB: ${err}`);
          });
        //Find Tagstatus
        const tag = await TagStatus.findOne({ tag_id: paramsAngle.tag_id});
        if (tag) {
          // Tagstatus exists, update it
          tag.aoa = data
          if(tag.zone_id != this.zone_id) {
            tag.is_new = true
          }
          tag.zone_id = this.zone_id
          await tag.save();
        } else {
          // Tagstatus does not exist, create a new one
          const newTag = new TagStatus({
            tag_id: paramsAngle.tag_id,
            aoa: data,
            zone_id: this.zone_id,
            time: new Date(),
            is_new: true
          });
          await newTag.save();
        }
      } else {
        var paramsManuf = MQTTPattern.exec(manufPattern, topic)
        if (paramsManuf) {
          const data = JSON.parse(message.toString());
          let wsmessage = {
            ...data,
            tag_id: paramsManuf.tag_id,
            "type": "manuf_data"
          }
          wscon.send(JSON.stringify(wsmessage).toString());
          if (!tag_ids.includes(paramsManuf.tag_id)) {
            tag_ids.push(paramsManuf.tag_id)
            const tag = await TagStatus.findOne({ tag_id: paramsManuf.tag_id});
            let status = "good"
            if (data.vbatt < 3) {
              status = "warning"
            }
            if (data.vbatt < 2.5) {
              status = "critical"
            }
            if (tag) {
              // Tag exists, update it
              if(tag.zone_id != this.zone_id) {
                tag.is_new = true
              }
              tag.manuf_data = data
              tag.time = new Date();
              tag.status = status
              tag.is_new = false
              tag.zone_id = this.zone_id
              await tag.save();
            } else {
              // Tag does not exist, create a new one
              const newTag = new TagStatus({
                tag_id: paramsManuf.tag_id,
                manuf_data: data,
                zone_id: this.zone_id,
                time: new Date(),
                status: status,
                is_new: true
              });
              await newTag.save();
            }

          } else {
            const tag = await TagStatus.findOne({ tag_id: paramsManuf.tag_id});
            let status = "good"
            if (data.vbatt < 3) {
              status = "warning"
            }
            if (data.vbatt < 2.5) {
              status = "critical"
            }
            if (tag) {
              // Tag exists, update it
              if(tag.zone_id != this.zone_id) {
                tag.is_new = true
              }
              tag.manuf_data = data
              tag.time = new Date();
              tag.status = status
              tag.zone_id = this.zone_id
              await tag.save();
            }

          }
          influx
            .writePoints([
              {
                measurement: "manuf_data",
                tags: {
                  tag_id: paramsManuf.tag_id,
                  antenna_id: paramsManuf.antenna_id,
                  zone: this.zone_id
                },
                fields: {
                  ...data
                },
                timestamp: data.timestamp,
              },
            ])
            .then(() => {
            })
            .catch((err) => {
              console.error(`Error writing data to InfluxDB: ${err}`);
            });
        } else {
          var paramsPosition = MQTTPattern.exec(positionPattern, topic)
          if (paramsPosition) {
            const data = JSON.parse(message.toString());
            let wsmessage = {
              ...data,
              tag_id: paramsPosition.tag_id,
              'location': paramsPosition.location,
              "type": "position_data"
            }
            wscon.send(JSON.stringify(wsmessage).toString());
            influx
              .writePoints([
                {
                  measurement: "position",
                  tags: {
                    tag_id: paramsPosition.tag_id,
                    location: paramsPosition.location,
                    zone: this.zone_id
                  },
                  fields: {
                    ...data
                  },
                  timestamp: data.timestamp,
                },
              ])
              .then(() => {
                //console.log("Data written to InfluxDB.");
              })
              .catch((err) => {
                console.error(`Error writing data to InfluxDB: ${err}`);
              });
            // const tag = await TagStatus.findOne({ tag_id: paramsPosition.tag_id, zone_id: this.zone_id });
            const tag = await TagStatus.findOne({ tag_id: paramsPosition.tag_id });
            if (tag) {
              // Tagstatus exists, update it
              tag.position = data
              if(tag.zone_id != this.zone_id) {
                tag.is_new = true
              }
              tag.zone_id = this.zone_id
              await tag.save();
            } else {
              // Tagstatus does not exist, create a new one
              const newTag = new TagStatus({
                tag_id: paramsPosition.tag_id,
                position: data,
                zone_id: this.zone_id,
                time: new Date(),
                is_new: true
              });
              await newTag.save();
            }
          }
        }

      }
    })

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