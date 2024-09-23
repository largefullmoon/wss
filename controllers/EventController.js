
const Zone = require('../models/Zone');
const Area = require('../models/Area');
const Asset = require('../models/Asset');
const Map = require('../models/Map');
const Event = require('../models/Event');
const Influx = require('influx');
const influx = new Influx.InfluxDB({
    host: "185.61.139.42",
    database: "fama",
});


const redis = require('redis');
// Create a Redis client
const client = redis.createClient({
    host: '127.0.0.1',  // Redis server host (use localhost for local server)
    port: 6379          // Redis server port
});

// Connect to Redis
client.connect().then(() => {
    console.log('Connected to Redis');
}).catch((err) => {
    console.error('Error connecting to Redis:', err);
});

const setDeviceInfo = async (deviceId, area, status) => {
    try {
        // Ensure the key is a string
        const key = `device:${deviceId}`;
        const data = { "area": area, "status": status }
        const jsonData = JSON.stringify(data)
        await client.hSet(key, 'deviceInfo', jsonData);
        console.log(`Device info set for ${deviceId}`);
    } catch (err) {
        console.error('Error setting device info:', err);
    }
};

// Function to get device information
const getDeviceInfo = async (deviceId) => {
    try {
        const key = `device:${deviceId}`;
        const jsonData = await client.hGet(key, 'deviceInfo');

        // Parse the JSON string back into an object
        if (jsonData) {
            const deviceInfo = JSON.parse(jsonData);
            return deviceInfo;
        } else {
            console.log(`Device ${deviceId} not found`);
            return {};
        }
    } catch (err) {
        console.error('Error getting device info:', err);
    }
};
async function getTagsLastLocation(zoneId = null) {
    try {
        const tagIds = [];
        let query = "";

        if (zoneId === null) {
            query = `select last(x),* from position group by tag_id ;`
        } else {
            console.log("getAntennasValues ZONEID ", zoneId)
            query = `select last(x),* from position WHERE zone='` + zoneId + `' group by tag_id`
        }
        await influx.query(query).then(results => {
            results.forEach(result => {
                tagIds.push(result.tag_id)
            })
        })
        return tagIds
    } catch (error) {
        console.log(error)
        return []
    }
};
let tagIds = []
let tagEvents = []
async function checkEvent(event, zone_id, areas) {
    const tagInfo = JSON.parse(event)
    if (tagIds.length == 0) {
        tagIds = await getTagsLastLocation(zone_id);
    }
    if (!areas) {
        const map = await Map.findOne({ zone: zone_id })
        areas = await Area.find({ map: map._id })
    }
    for (let i = 0; i < areas.length; i++) {
        const currentStatus = await getDeviceInfo(tagInfo.tag_id);
        if (areas[i].top_right.x >= tagInfo.x && areas[i].top_right.y >= tagInfo.y && areas[i].bottom_left.x <= tagInfo.x && areas[i].bottom_left.y <= tagInfo.y) {
            console.log("currentStatus", currentStatus)
            if ((currentStatus?.status != "out" && currentStatus?.status != "in") || (currentStatus?.status == 'out' && currentStatus?.area == areas[i]._id)) {
                await setDeviceInfo(tagInfo.tag_id, areas[i]._id, 'in');
                // if (tagEvents[tag_id]) {
                //     if (tagEvents[tag_id][areas[i]._id] == "in")
                //         continue
                // }
                // tagEvents[tag_id][areas[i]._id] == "in"
                const type = "in area"
                const object = tagInfo.tag_id
                const zone = zone_id
                const area = areas[i]._id
                const information = "Tag cross in Area"
                const newEvent = new Event({
                    type,
                    object,
                    zone,
                    area,
                    information
                });
                await newEvent.save();
            }
        } else {
            if (currentStatus?.status == 'in' && currentStatus?.area == areas[i]._id) {
                setDeviceInfo(tagInfo.tag_id, areas[i]._id, 'out');
                // if (tagEvents[tag_id]) {
                //     if (tagEvents[tag_id][areas[i]._id] == "out")
                //         continue
                // }
                // tagEvents[tag_id][areas[i]._id] == "out"
                const type = "out area"
                const object = tagInfo.tag_id
                const zone = zone_id
                const area = areas[i]._id
                const information = "Tag left the Area"
                const newEvent = new Event({
                    type,
                    object,
                    zone,
                    area,
                    information
                });
                await newEvent.save();
            }
        }
    }
    if (!tagIds.includes(tagInfo.tag_id)) {
        const type = "detected"
        const object = tagInfo.tag_id
        const zone = zone_id
        const information = "New tag is detected on Zone"
        const newEvent = new Event({
            type,
            object,
            zone,
            information
        });
        await newEvent.save();
        console.log("New tag is detected")
        tagIds = await getTagsLastLocation(zone_id);
    }

}
module.exports = {
    checkEvent
};
