const mqtt = require('mqtt')

async function mqtt_client (mqttServer , topic ,antennaId, deviceId, username='' , password='' ){
    const clientId = `node_${Math.random().toString(16).slice(3)}`
    const client = mqtt.connect(mqttServer, {
        clientId,
        clean: true,
        connectTimeout: 4000,
        reconnectPeriod: 1000,
      })
      client.on('connect', () => {
        client.subscribe([topic], () => {
          console.log(`Subscribe to topic '${topic}'`)
        })
      })
    
      client.on('error', () => {
        console.log('ERROR:', error)
      })
      client.on("message", (topic, message) => {
        const data = JSON.parse(message.toString());
        const x = data.distance * Math.cos(data.azimuth)*Math.sin(data.elevation)
        const y = data.distance * Math.sin(data.azimuth)*Math.sin(data.elevation)
        const z = data.distance
        console.log(`Received message on topic '${topic}': ${data.azimuth}`);

        // Parse the message payload as JSON
    })  
}


module.exports = {mqtt_client} ;
