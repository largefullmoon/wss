const mqtt = require('mqtt');
const Influx = require("influx");
const WebSocket = require('ws');
var MQTTPattern = require("mqtt-pattern");

const influx = new Influx.InfluxDB({
  host: "localhost",
  database: "fama",
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
    console.log("starting mqtt handler ", this.zone_id)
    var wscon = new WebSocket("ws://185.61.139.41:8080/" + this.zone_id);

    var anglePattern = this.angle_topic.slice(0, -1) + "+antenna_id/+tag_id";
    var manufPattern = this.manuf_topic.slice(0, -1) + "+antenna_id/+tag_id";
    var positionPattern = this.position_topic.slice(0, -1) + "+location/+tag_id";


    this.mqttClient = mqtt.connect('mqtt://' + this.host, this.mqtt_options);
    this.mqttClient.on('error', (err) => {
      console.log(err);
      this.mqttClient.reconnect();
    });
    this.mqttClient.on('connect', () => {
      this.mqttClient.subscribe(this.angle_topic);
      this.mqttClient.subscribe(this.manuf_topic);
      this.mqttClient.subscribe(this.position_topic);

      console.log(`mqtt client connected`);
    });
    this.mqttClient.on('close', () => {
      console.log(`mqtt client disconnected`);
    });
    this.mqttClient.on("message", (topic, message) => {
      //parsing
      var paramsAngle = MQTTPattern.exec(anglePattern, topic)
      if (paramsAngle) {
        //    console.log('angle topic ', paramsAngle.antenna_id, paramsAngle.tag_id)  
        const data = JSON.parse(message.toString());

        // Write the data to InfluxDB
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
            //console.log("Data written to InfluxDB.");
          })
          .catch((err) => {
            console.error(`Error writing data to InfluxDB: ${err}`);
          });

      } else {
        var paramsManuf = MQTTPattern.exec(manufPattern, topic)
        if (paramsManuf) {
          const data = JSON.parse(message.toString());

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
              //console.log("Data written to InfluxDB.");
            })
            .catch((err) => {
              console.error(`Error writing data to InfluxDB: ${err}`);
            });


        } else {
          var paramsPosition = MQTTPattern.exec(positionPattern, topic)
          if (paramsPosition) {

            //console.log('position topic ', paramsPosition.location, paramsPosition.tag_id)
            const data = JSON.parse(message.toString());
            let wsmessage = {
              ...data,
              tag_id: paramsPosition.tag_id
            }
            console.log(wsmessage)
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
          }
        }

      }
      /* //send message to each ws client 
       
       */

      // 1 parse message - 
      // a. topic : positioning location ( put angles as it is ) , coordinates , set zone_id  for all messages 
      // b. message : device : register antenna , register
      // c 
      // 2 apply filters -  user defined ?  
      // 3 write to database 
      // 4 stream to clients    

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

//   // Sends a mqtt message to topic: mytopic




module.exports = MqttHandler;