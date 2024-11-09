
const Zone = require('../models/Zone');
const Area = require('../models/Area');
const Asset = require('../models/Asset');
const Map = require('../models/Map');
const Action = require('../models/Action');
const Event = require('../models/Event');
const TagStatus = require('../models/TagStatus.js');
const EventType = require('../models/EventType.js');
const WebHookModel = require('../models/webHook.js');
const Influx = require('influx');
const axios = require('axios');
const nodemailer = require('nodemailer');
const influx = new Influx.InfluxDB({
    host: "185.61.139.41",
    database: "prod",
});
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 9000 });
const transporter = nodemailer.createTransport({
    host: '185.62.188.4',
    port: 465,
    secure: true,
    auth: {
        user: 'test@tonytest.top',
        pass: '(Y$f9}[,0)dy',
    },
    tls: {
        rejectUnauthorized: false
    }
});
const clients = [];
// const { ClickHouse } = require('@clickhouse/client');
wss.on('connection', (ws, req) => {
    const interval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.ping(); // Send ping
        } else {
            clearInterval(interval);
        }
    }, 3000); // Ping every 30 seconds

    ws.on('pong', () => {
        console.log("receive pong from client");
    });

    ws.on('close', () => {
        clearInterval(interval); // Clear interval when the client disconnects
        channels[channel] = channels[channel].filter((client) => client !== ws);
    });
    clients.push(ws)
});
const runWebHook = async (webHook, data, type) => {
    if (webHook.type == "email") {
        const text = data.message
        const mailOptions = {
            from: 'test@tonytest.top',
            to: webhookUrl.email,
            subject: 'Alert from Cotrax',
            text: text,
            html: `<b>${text}</b>`,
        };
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log('Error occurred:', error);
            } else {
                console.log('Email sent:', text);
            }
        });
    }
    if (webHook.type == "webhook") {
        try {
            const params = webHook.params;
            let postData = {}
            const asset = await Asset.findOne({ tag: data['tag_id'] });
            for (let i = 0; i < params.length; i++) {
                if (params[i].type == "default") {
                    switch (params[i].related) {
                        case "area_id":
                            postData[params[i].key] = data[params[i].related];
                            break;
                        case "area_name":
                            postData[params[i].key] = data[params[i].related];
                            break;
                        case "tag_id":
                            postData[params[i].key] = data[params[i].related];
                            break;
                        case "zone_id":
                            postData[params[i].key] = data[params[i].related];
                            break;
                        case "zone_name":
                            const zone = await Zone.findById(data['zone_id']);
                            postData[params[i].key] = zone.name;
                        case "asset_id":
                            if (asset) {
                                postData[params[i].key] = asset._id;
                            }
                            break;
                        case "asset_name":
                            if (asset) {
                                postData[params[i].key] = asset.title;
                            }
                            break;
                        default:
                            break;
                    }
                }
                if (params[i].type == "custom") {
                    postData[params[i].key] = params[i].value
                }
            }
            const response = await axios.post(webHook.webhookUrl, postData, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            console.log('Response:', response);
        } catch (error) {
            console.error('Error sending POST request:', error.message);
        }
    }
}
const broadcastToClients = async (data, type, category) => {
    const zone = await Zone.findOne(data['zone_id']);
    const actions = await Action.find({ company_id: zone.company.toString() }).populate('eventType').populate('webHook');
    actions.forEach(async (action) => {
        if (action.eventType.category == category && action.eventType.condition.indexOf(type) >= 0) {
            if (action.status == 1 && action.webHook && action.targetType) {
                if (action.executionType == "once" && action.count >= 1) {
                } else {
                    await runWebHook(action.webHook, data, type);
                    action.count = action.count + 1;
                    await action.save();
                }
            }
        }
    });
    clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}
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
            query = `select last(x),* from position WHERE zone='` + zoneId + `' group by tag_id`
        }
        await influx.query(query).then(results => {
            results.forEach(result => {
                tagIds.push(result.tag_id)
            })
        })
        return tagIds
    } catch (error) {
        return []
    }
};
let tagIds = []
let tagEvents = []
async function checkEvent(event, zone_id, areas, ws) {
    const tagInfo = JSON.parse(event)
    if (tagIds.length == 0) {
        tagIds = await getTagsLastLocation(zone_id);
    }
    if (!areas) {
        const map = await Map.findOne({ zone: zone_id })
        areas = await Area.find({ map: map._id })
    }
    if (tagInfo.type == "position_data") {

        for (let i = 0; i < areas.length; i++) {
            const currentStatus = await getDeviceInfo(tagInfo.tag_id);
            if (areas[i].top_right.x >= tagInfo.x && areas[i].top_right.y >= tagInfo.y && areas[i].bottom_left.x <= tagInfo.x && areas[i].bottom_left.y <= tagInfo.y) {
                if ((currentStatus?.status != "out" && currentStatus?.status != "in") || (currentStatus?.status == 'out') || (currentStatus?.status == 'in' && currentStatus?.area != areas[i]._id.toString())) {
                    await setDeviceInfo(tagInfo.tag_id, areas[i]._id, 'in');
                    const category = 'location'
                    const type = "tag_entered_area"
                    const object = tagInfo.tag_id
                    const zone = zone_id
                    const area = areas[i]._id
                    const information = "Tag cross in Area"
                    const newEvent = new Event({
                        category,
                        type,
                        object,
                        zone,
                        area,
                        information
                    });
                    await newEvent.save();
                    const data = {
                        'zone_id': zone_id,
                        'tag_id': tagInfo.tag_id,
                        'area_id': tagInfo.tag_id,
                        'area_name': tagInfo.tag_id,
                        'message': `Tag (${tagInfo.tag_id}) cross in Area (${areas[i]._id} ${areas[i].desc ? "," + areas[i].desc : ""})`,
                    }
                    broadcastToClients(data, "tag_entered_area", "location")
                    // const query = `
                    //     CREATE TABLE IF NOT EXISTS event (
                    //         id UUID DEFAULT generateUUIDv4(),
                    //         type String,
                    //         object String,
                    //         zone String,
                    //         area String,
                    //         information String,
                    //         timestamp DateTime
                    //     )
                    //     ENGINE = MergeTree
                    //     PRIMARY KEY (id, timestamp)
                    //     `;

                    // // Execute the query
                    // await clickhouse.query(query).toPromise();
                    // const insertQuery = `
                    //     INSERT INTO event (type, object, zone, area, information)
                    //     VALUES ('${type}', '${object}', '${zone}', '${area}', '${information}')
                    // `;
                    // await clickhouse.query(insertQuery).toPromise();
                }
            } else {
                if (currentStatus?.status == 'in' && currentStatus?.area == areas[i]._id.toString()) {
                    setDeviceInfo(tagInfo.tag_id, areas[i]._id, 'out');
                    const category = 'location'
                    const type = "tag_exited_area"
                    const object = tagInfo.tag_id
                    const zone = zone_id
                    const area = areas[i]._id
                    const information = "Tag left the Area"
                    const newEvent = new Event({
                        category,
                        type,
                        object,
                        zone,
                        area,
                        information
                    });
                    await newEvent.save();
                    const data = {
                        'zone_id': zone_id,
                        'tag_id': tagInfo.tag_id,
                        'area_id': tagInfo.tag_id,
                        'area_name': tagInfo.tag_id,
                        'message': `Tag (${tagInfo.tag_id}) left the Area (${areas[i]._id} ${areas[i].desc ? "," + areas[i].desc : ""})`,
                    }
                    broadcastToClients(data, "tag_exited_area", "location")
                    // const query = `
                    //     CREATE TABLE IF NOT EXISTS event (
                    //         id UUID DEFAULT generateUUIDv4(),
                    //         type String,
                    //         object String,
                    //         zone String,
                    //         area String,
                    //         information String,
                    //         timestamp DateTime
                    //     )
                    //     ENGINE = MergeTree
                    //     PRIMARY KEY (id, timestamp)
                    //     `;

                    // // Execute the query
                    // await clickhouse.query(query).toPromise();
                    // const insertQuery = `
                    //     INSERT INTO event (type, object, zone, area, information)
                    //     VALUES ('${type}', '${object}', '${zone}', '${area}', '${information}')
                    // `;
                    // await clickhouse.query(insertQuery).toPromise();
                }
            }
        }
    }
    // if (!tagIds.includes(tagInfo.tag_id)) {
    //     const type = "tag_detected"
    //     const object = tagInfo.tag_id
    //     const zone = zone_id
    //     const data = {
    //         'tag_id': tagInfo.tag_id,
    //         'zone_id': zone_id,
    //         'message': `New Tag (${tagInfo.tag_id}) is detected on Zone (${zone_id})`,
    //     }
    //     broadcastToClients(data)
    //     const information = "New tag is detected on Zone"
    //     const category = 'info'
    //     const newEvent = new Event({
    //         category,
    //         type,
    //         object,
    //         zone,
    //         information
    //     });
    //     await newEvent.save();
    //     // const query = `
    //     //             CREATE TABLE IF NOT EXISTS event (
    //     //                 id UUID DEFAULT generateUUIDv4(),
    //     //                 type String,
    //     //                 object String,
    //     //                 zone String,
    //     //                 area String,
    //     //                 information String,
    //     //                 timestamp DateTime
    //     //             )
    //     //             ENGINE = MergeTree
    //     //             PRIMARY KEY (id, timestamp)
    //     //             `;
    //     // // Execute the query
    //     // await clickhouse.query(query).toPromise();
    //     // const insertQuery = `
    //     //             INSERT INTO event (type, object, zone, area, information)
    //     //             VALUES ('${type}', '${object}', '${zone}', '${area}', '${information}')
    //     //         `;
    //     // await clickhouse.query(insertQuery).toPromise();
    //     tagIds = await getTagsLastLocation(zone_id);
    // }

}
async function checkTagStatus() {
    
    const tags = await TagStatus.find()
    tags.forEach(async (tag) => {
        const zoneDetail = await Zone.findById(tag.zone_id)
        const currentTime = new Date();
        const tagTime = new Date(tag.time);
        const timeDifference = currentTime - tagTime;
        if (timeDifference > 5 * 60 * 1000 && tag.status != 'no data' && tag.status != 'lost') {
            const category = "info";
            tag.status = 'no data'; // Update the status
            await tag.save(); // Save the updated tag
            const data = {
                'tag_id': tag.tag_id,
                'zone_id': tag.zone_id,
                'message': `Tag (${tag.tag_id}) sent no data on Zone(${tag.zone_id}, ${zoneDetail?.title})`
            }
            broadcastToClients(data, "tag_nodata", "info")
            const type = "tag_nodata";
            const object = tag.tag_id;
            const zone = tag.zone_id;
            const information = `Tag (${tag.tag_id}) sent no data on Zone(${tag.zone_id}, ${zoneDetail?.title})`
            const newEvent = new Event({
                category,
                type,
                object,
                zone,
                information
            });
            await newEvent.save();
        }
        if (timeDifference > 120 * 60 * 1000 && tag.status != 'lost') {
            const category = "info";
            tag.status = 'lost'; // Update the status
            await tag.save(); // Save the updated tag
            const data = {
                'tag_id': tag.tag_id,
                'zone_id': tag.zone_id,
                'message': `Tag (${tag.tag_id}) is lost on Zone(${tag.zone_id}, ${zoneDetail?.title})`
            }
            broadcastToClients(data, "tag_lost", "info")
            const type = "tag_lost";
            const object = tag.tag_id;
            const zone = tag.zone_id;
            const information = `Tag (${tag.tag_id}) is lost on Zone(${tag.zone_id}, ${zoneDetail?.title})`
            const newEvent = new Event({
                category,
                type,
                object,
                zone,
                information
            });
            await newEvent.save();
        }
        if (tag.is_new == true) {
            const category = "info";
            tag.is_new = false; // Update the status
            await tag.save(); // Save the updated tag
            const data = {
                'tag_id': tag.tag_id,
                'zone_id': tag.zone_id,
                'message': `New tag(${tag.tag_id}) is detected on Zone(${tag.zone_id}, ${zoneDetail?.title})`
            }
            broadcastToClients(data, "tag_detected", "info")
            const type = "tag_detected";
            const object = tag.tag_id;
            const zone = tag.zone_id;
            const information = `New tag(${tag.tag_id}) is detected on Zone(${tag.zone_id}, ${zoneDetail?.title})`
            const newEvent = new Event({
                category,
                type,
                object,
                zone,
                information
            });
            await newEvent.save();
        }
        if (tag.manuf_data) {
            const zone = await Zone.findById(tag.zone_id)
            let middle_standard = 3.0
            let low_standard = 2.3
            const category = "issue";
            let type = ""
            if (tag.manuf_data.vbatt >= middle_standard && tag.battery_status != "battery_good" && tag.status != 'no data' && tag.status != 'lost') {
                content = `battery(${tag.manuf_data.vbatt}) is good`
                type = "battery_good"
            }
            if (tag.manuf_data.vbatt >= low_standard && tag.battery_status != "battery_middle" && tag.status != 'no data' && tag.status != 'lost') {
                content = `battery(${tag.manuf_data.vbatt}) is middle`
                type = "battery_middle"
            }
            if (tag.manuf_data.vbatt < low_standard && tag.battery_status != "battery_low" && tag.status != 'no data' && tag.status != 'lost') {
                content = `battery(${tag.manuf_data.vbatt}) is low`
                type = "battery_low"
            }
            if (type != "") {
                const data = {
                    'tag_id': tag.tag_id,
                    'zone_id': tag.zone_id,
                    'message': `tag(${tag.tag_id})'s` + content,
                }
                const object = tag.tag_id;
                const zone = tag.zone_id;
                const information = `tag(${tag.tag_id})'s ` + content;
                broadcastToClients(data, type, "issue")
                tag.battery_status = type
                await tag.save();
                const newEvent = new Event({
                    category,
                    type,
                    object,
                    zone,
                    information
                });
                await newEvent.save();
            }
        }
    })

}
setInterval(() => {
    checkTagStatus()
}, 5 * 60 * 1000);
module.exports = {
    checkEvent
};
