
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
let isChecking = false
let checkingTags = []
let checkingTagConditions = []
const influx = new Influx.InfluxDB({
    host: "185.61.139.41",
    database: "prod",
});
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 9000 });
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: 'alerts@cotrax.io',
        pass: 'pjxb nngg wlyx wuld',
    },
    tls: {
        rejectUnauthorized: false
    }
});
let isStartStatus = true;
let isStartPosition = true;
let statuses = []
let positions = []
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
        // console.log("receive pong from client");
    });

    ws.on('close', () => {
        clearInterval(interval); // Clear interval when the client disconnects
    });
    clients.push(ws)
});
const defaultURLParams = [
    { name: "Area Id", key: "area_id" },
    { name: "Area Name", key: "area_name" },
    { name: "Tag Id", key: "tag_id" },
    { name: "Zone Id", key: "zone_id" },
    { name: "Zone Name", key: "zone_name" },
    { name: "Asset Id", key: "asset_id" },
    { name: "Asset Name", key: "asset_name" },
    { name: "Last Position", key: "last_position" }
]
const runWebHook = async (webHook, data) => {
    if (webHook.type == "email") {
        let subject = webHook.subject
        const asset = await Asset.findOne({ tag: data['tag_id'] });
        for (let i = 0; i < defaultURLParams?.length; i++) {
            if (subject.indexOf(`@[${defaultURLParams[i].name}](${defaultURLParams[i].key})`) != -1) {
                let value = ""
                switch (defaultURLParams[i].key) {
                    case "area_id":
                        value = data[defaultURLParams[i].key];
                        break;
                    case "area_name":
                        value = data[defaultURLParams[i].key];
                        break;
                    case "tag_id":
                        value = data[defaultURLParams[i].key];
                        break;
                    case "zone_id":
                        value = data[defaultURLParams[i].key];
                        break;
                    case "zone_name":
                        const zone = await Zone.findById(data['zone_id']);
                        value = zone.title;
                    case "asset_id":
                        if (asset) {
                            value = asset._id;
                        }
                        break;
                    case "asset_name":
                        if (asset) {
                            value = asset.title;
                        }
                        break;
                    case "last_position":
                        const tag_id = data['tag_id']
                        const tag = await TagStatus.findOne({ tag_id: tag_id });
                        if (tag) {
                            value = JSON.stringify(tag.position);
                        }
                        break;
                    default:
                        break;
                }
                const regex = new RegExp(`@\\[${defaultURLParams[i].name}\\]\\(${defaultURLParams[i].key}\\)`, "g");
                subject = subject.replace(regex, value);
            }
        }
        let email_text = ""
        if (data.conditions.length > 0) {
            data.conditions.map((condition, index) => {
                if (data.conditions.length > 1) {
                    email_text += (index + 1) + "." + condition.description + "\n"
                } else {
                    email_text += condition.description
                }
            })
        }
        if (email_text == "") {
            email_text = webHook.description
        }
        const tag_id = data['tag_id']
        const tagStatus = await TagStatus.findOne({ tag_id: tag_id });
        const zone = await Zone.findById(data['zone_id']);
        if (zone) {
            email_text += `<br/> Location : zone ${zone.title}, `
        }
        if (tagStatus) {
            email_text += `coordinates (X: ${tagStatus.position.x}, Y: ${tagStatus.position.y}, Z: ${tagStatus.position.z})`
        }
        webHook.emails.forEach((email) => {
            const mailOptions = {
                from: 'alerts@cotrax.io',
                to: email,
                subject: subject,
                text: email_text,
                html: `<b>${email_text}</b>`,
            };
            transporter.sendMail(mailOptions, async (error, info) => {
                if (error) {
                    console.log("error in sending email", email)
                    await WebHookModel.updateOne({ _id: webHook._id }, { failcount: webHook.failcount + 1 })
                } else {
                    console.log("sent email to ", email)
                    await WebHookModel.updateOne({ _id: webHook._id }, { sentcount: webHook.sentcount + 1 })
                }
            })
        });
    }
    if (webHook.type == "dashboard_notification") {
        console.log("dashboard_notification")
        broadcastToClients({ ...data, message: webHook.message })
        await Notification.create({ tag_id: data.tag_id, zone_id: data.zone_id, message: webHook.message, readUserIds: [] })
        await WebHookModel.updateOne({ _id: webHook._id }, { sentcount: webHook.sentcount + 1 })
    }
    if (webHook.type == "webhook") {
        console.log("webhook")
        try {
            const isURLParams = webHook.isURLParams;
            let params = webHook.params;
            if (!params) {
                params = []
            }
            let urlParams = webHook?.urlParams;
            if (!urlParams) {
                urlParams = []
            }
            let postData = { 'conditions': data.conditions }
            const asset = await Asset.findOne({ tag: data['tag_id'] });
            let urlParamsData = { 'conditions': data.conditions }
            for (let i = 0; i < urlParams?.length; i++) {
                if (urlParams[i].type == "default") {
                    switch (urlParams[i].related) {
                        case "area_id":
                            urlParamsData[urlParams[i].key] = data[urlParams[i].related];
                            break;
                        case "area_name":
                            urlParamsData[urlParams[i].key] = data[urlParams[i].related];
                            break;
                        case "tag_id":
                            urlParamsData[urlParams[i].key] = data[urlParams[i].related];
                            break;
                        case "zone_id":
                            urlParamsData[urlParams[i].key] = data[urlParams[i].related];
                            break;
                        case "zone_name":
                            const zone = await Zone.findById(data['zone_id']);
                            urlParamsData[urlParams[i].key] = zone.title;
                            break;
                        case "asset_id":
                            if (asset) {
                                urlParamsData[urlParams[i].key] = asset._id;
                            }
                            break;
                        case "asset_name":
                            if (asset) {
                                urlParamsData[urlParams[i].key] = asset.title;
                            }
                            break;
                        case "last_position":
                            const tag_id = data['tag_id']
                            const positionData = await TagStatus.findOne({ tag_id: tag_id });
                            if (positionData) {
                                urlParamsData[urlParams[i].key] = JSON.stringify(positionData);
                            }
                            break;
                        default:
                            break;
                    }
                }
                if (urlParams[i].type == "custom") {
                    urlParamsData[urlParams[i].key] = urlParams[i].value
                }
            }
            for (let i = 0; i < params?.length; i++) {
                if (params[i].type == "default") {
                    switch (params[i].related) {
                        case "url_params":
                            postData[params[i].key] = JSON.stringify(urlParamsData);
                            break;
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
                        case "last_position":
                            const tag_id = data['tag_id']
                            const positionData = await TagStatus.findOne({ tag_id: tag_id });
                            if (positionData) {
                                postData[params[i].key] = JSON.stringify(positionData);
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
            if (isURLParams) {
                const ps = new URLSearchParams(postData).toString();
                const response = await axios.get(`${webHook.webhookUrl}?${ps}`);
            } else {
                const response = await axios.post(webHook.webhookUrl, postData, {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
            }
            await WebHookModel.updateOne({ _id: webHook._id }, { sentcount: webHook.sentcount + 1 })
        } catch (error) {
            await WebHookModel.updateOne({ _id: webHook._id }, { failcount: webHook.failcount + 1 })
            console.error('Error sending POST request:', error.message);
        }
    }
}
const broadcastToClients = async (data) => {
    clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
    await axios.get(`https://api.telegram.org/bot7520070918:AAFGmwD595Q6fAg-ULjVxIMRbieWKS40Sic/sendMessage?chat_id=-1002472757446&text=${data.message}`);
}
const redis = require('redis');
const { CategoryCondition } = require('../models/CategoryCondition.js');
const { Category } = require('../models/Category.js');
const { Condition } = require('../models/Condition.js');
const EventCount = require('../models/EventCount.js');
console.log(Category, "Category")
console.log(Condition, "Condition")
const AssetEventCount = require('../models/AssetEventCount.js');
const AssetPosition = require('../models/AssetPosition.js');
const AssetStatus = require('../models/AssetStatus.js');
const Notification = require('../models/Notification.js');
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

async function getTagStatus(tag_id, zone_id, type, data) {
    const tag = await TagStatus.findOne({ tag_id: tag_id });
    if (type == 'aoa_data') { type = 'aoa' }
    if (type == 'position_data') { type = 'position' }

    if (tag) {
        // Tagstatus exists, update it
        if (tag.zone_id != zone_id) {
            tag.is_new = true;
            if (tag.zone_id) {
                tag.previous_zone_id = tag.zone_id
                const category = "info";
                const previousZoneDetail = await Zone.findById(tag.zone_id)
                let data = {
                    'tag_id': tag.tag_id,
                    'zone_id': tag.zone_id,
                    'message': `Tag(${tag.tag_id}) exit from the Zone(${tag.zone_id}, ${previousZoneDetail?.title})`
                }
                const asset = await Asset.findOne({ tag: tag.tag_id });
                if (asset) {
                    data = {
                        'tag_id': tag.tag_id,
                        'zone_id': tag.zone_id,
                        'message': `Asset(${asset.title}) exit from the Zone(${tag.zone_id}, ${previousZoneDetail?.title})`
                    }
                }
                broadcastToClients(data)
                const type = "tag_exited";
                const object = tag.tag_id;
                const zone = tag.zone_id;
                const information = `Tag(${tag.tag_id}) exit from the Zone(${tag.zone_id}, ${previousZoneDetail?.title})`
                if (asset) {
                    const information = `Asset(${asset.title}) exit from the Zone(${tag.zone_id}, ${previousZoneDetail?.title})`
                }
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
        if (tag[type] != null) {
            let old_type = 'previous_' + type
            tag[old_type] = tag[type]
        }
        tag[type] = data
        tag.zone_id = zone_id
        tag.time = new Date()
        tag.isCheckingPosition = true
        const tagStatus = await tag.save();
        return tagStatus
    } else {
        // Tagstatus does not exist, create a new one
        const newTag = new TagStatus({
            tag_id: tag_id,
            [type]: data,
            zone_id: zone_id,
            time: new Date(),
            is_new: true
        });
        const tagStatus = await newTag.save();
        return tagStatus
    }
}

async function checkEvent(event, zone_id, type, tag_id, areas, ws) {
    const tagInfo = JSON.parse(event)
    const tagStatus = await getTagStatus(tag_id, zone_id, type, tagInfo)
    tagInfo.type = type
    const assets = await Asset.find()
    if (tagIds.length == 0) {
        tagIds = await getTagsLastLocation(zone_id);
    }
    if (!areas) {
        const map = await Map.findOne({ zone: zone_id })
        if (map) {
            areas = await Area.find({ map: map._id })
        }
    }

    if (tagInfo.type == "manuf_data") {
        if (tagInfo.movement_status == 0) {
            if (assets.filter(asset => asset.tag == tag_id)[0]) {
                const previousdata = await AssetStatus.find({ tag_id: tag_id, zone_id: zone_id, startTime: { $exists: true }, stopTime: { $exists: false } }).sort({ createdAt: -1 });
                if (previousdata.length > 0) {
                } else {
                    if (statuses.filter(status => status.tag_id == tag_id && status.zone_id == zone_id).length == 0) {
                        statuses.push({
                            tag_id: tag_id,
                            zone_id: zone_id
                        })
                        const assetstatus = new AssetStatus({
                            asset_id: assets.filter(asset => asset.tag == tag_id)[0]?._id,
                            tag_id: tag_id,
                            zone_id: zone_id,
                            startTime: new Date(),
                            movement_status: tagInfo.movement_status
                        })
                        await assetstatus.save()
                    }
                }
            }
        } else {
            if (assets.filter(asset => asset.tag == tag_id)[0]) {
                const previousdatas = await AssetStatus.find({ tag_id: tag_id, zone_id: zone_id, startTime: { $exists: true }, stopTime: { $exists: false } }).sort({ createdAt: -1 });
                statuses = statuses.filter(status => !status.tag_id == tag_id && status.zone_id == zone_id)
                previousdatas.map(async (previousdata) => {
                    if (previousdata && previousdata.movement_status == 0) {
                        previousdata.stopTime = new Date()
                        previousdata.movement_status = tagInfo.movement_status
                        await previousdata.save()
                    }
                })
            }
        }
    }
    let area_id;
    if (tagInfo.type == "position_data") {
        for (let i = 0; i < areas.length; i++) {
            const currentStatus = await getDeviceInfo(tag_id);
            if (areas[i].top_right.x >= tagInfo.x && areas[i].top_right.y >= tagInfo.y && areas[i].bottom_left.x <= tagInfo.x && areas[i].bottom_left.y <= tagInfo.y) {
                if ((currentStatus?.status != "out" && currentStatus?.status != "in") || (currentStatus?.status == 'out') || (currentStatus?.status == 'in' && currentStatus?.area != areas[i]._id.toString())) {
                    if (assets.filter(asset => asset.tag == tag_id)[0]) {
                        const previousdata = await AssetPosition.find({ tag_id: tag_id, zone_id: zone_id, area_id: areas[i]._id, enterTime: { $exists: true }, exitTime: { $exists: false } }).sort({ createdAt: -1 });
                        if (previousdata > 0) {
                        } else {
                            if (positions.filter(position => position.tag_id == tag_id && position.zone_id == zone_id).length == 0) {
                                positions.push({
                                    tag_id: tag_id,
                                    zone_id: zone_id
                                })
                                const assetposition = await AssetPosition({
                                    asset_id: assets.filter(asset => asset.tag == tag_id)[0]?._id,
                                    tag_id: tag_id,
                                    zone_id: zone_id,
                                    area_id: areas[i]._id,
                                    enterTime: new Date()
                                })
                                area_id = areas[i]._id
                                await assetposition.save()
                            }
                        }
                    }
                    await setDeviceInfo(tag_id, areas[i]._id, 'in');
                    const category = 'location'
                    const type = "tag_entered_area"
                    const object = tag_id
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
                        'tag_id': tag_id,
                        'area_id': area,
                        'area_name': tag_id,
                        'message': `Tag (${tag_id}) cross in Area (${areas[i]._id} ${areas[i].desc ? "," + areas[i].desc : ""})`,
                    }
                    broadcastToClients(data)
                    const tag = await TagStatus.findOne({ tag_id: tag_id })
                    tag.enterOrExit = "enter"
                    tag.area_id = area
                    tag.enterOrExitTime = new Date();
                    await tag.save()
                    const actions = await Action.find({ status: 1, tag_id: tag.tag_id }).populate('locationcondition_id')
                    actions.forEach(action => {
                        if (action.locationcondition_id) {
                            if (action.count > 0 && action.executionType == "once") {
                                return false
                            }
                            if (action.locationcondition_id.name == 'tag_entered_area') {
                                runAction(action, [data])
                            }
                        }
                    });
                }
            } else {
                if (currentStatus?.status == 'in' && currentStatus?.area == areas[i]._id.toString()) {
                    const assetpositions = await AssetPosition.find({ tag_id: tag_id, zone_id: zone_id, area_id: areas[i]._id, enterTime: { $exists: true }, exitTime: { $exists: false } }).sort({ createdAt: -1 });
                    positions = positions.filter(position => !position.tag_id == tag_id && position.zone_id == zone_id)
                    assetpositions.map(async (assetposition) => {
                        assetposition.exitTime = new Date();
                        await assetposition.save()
                    })
                    setDeviceInfo(tag_id, areas[i]._id, 'out');
                    const category = 'location'
                    const type = "tag_exited_area"
                    const object = tag_id
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
                        'tag_id': tag_id,
                        'area_id': tag_id,
                        'area_name': tag_id,
                        'message': `Tag (${tag_id}) left the Area (${areas[i]._id} ${areas[i].desc ? "," + areas[i].desc : ""})`,
                    }
                    broadcastToClients(data)
                    const tag = await TagStatus.findOne({ tag_id: tag_id })
                    tag.enterOrExit = "exit"
                    tag.area_id = area
                    tag.enterOrExitTime = new Date();
                    await tag.save()
                    const actions = await Action.find({ status: 1, tag_id: tag.tag_id }).populate('locationcondition_id')
                    actions.forEach(async (action) => {
                        if (action.locationcondition_id) {
                            if (action.locationcondition_id.name == 'tag_exited_area') {
                                if (action.count > 0 && action.executionType == "once") {
                                    return false
                                }
                                await Action.findByIdAndUpdate(action._id, { count: action.count + 1 })
                                runAction(action, [data])
                            }
                        }
                    });
                }
            }
        }
    }
    await checkTag(tagStatus, "real-time", null, area_id)
}

const checkCustomCondition = async (tag, condition, category) => {
    if (condition.type == "custom") {
        if (tag[condition.category]) {
            let compareString = ""
            condition.conditions.forEach((param, index) => {
                let logic_ope = ""
                if (index != 0) {
                    if (param.logic_operator == "And") {
                        logic_ope = "&&"
                    }
                    if (param.logic_operator == "Or") {
                        logic_ope = "||"
                    }
                }
                let checkingPreviousStatusOperator = param.operator
                if (param.operator == "==") {
                    checkingPreviousStatusOperator = "!="
                }
                if (param.operator == "<>") {
                    checkingPreviousStatusOperator = "=="
                }
                const checkingPreviousStatusString = param.standard_value + checkingPreviousStatusOperator + tag['previous_' + condition.category][param.param]
                compareString += logic_ope + "(" + checkingPreviousStatusString + "&&" + tag[condition.category][param.param] + param.operator + param.standard_value + ")"
            })
            if (tag.tag_id == "ble-pd-0C4314EF65DC") {
                console.log(compareString)
            }
            if (eval(compareString) && compareString != "") {
                return true
            } else {
                return false
            }
        }
        return false
    } else {
        return false
    }
}

const checkActionWithConditions = async (tag_id, action, conditions) => {
    let isLocationCondition = false
    let localtionCondition = ''
    const eventType = await EventType.findById(action.eventType).populate('params.category_id')
    let compareString = "true&&"
    let number = 0
    eventType.params.forEach((param, index) => {
        let flag = false
        if (param.category_id.name == "location") {
            isLocationCondition = true
            localtionCondition = param.condition_id
            flag = true
        } else {
            number++
            if (number != 1) {
                if (param.operator == "And") {
                    ope = "&&"
                }
                if (param.operator == "Or") {
                    ope = "||"
                }
                compareString += ope
            }
            conditions.forEach(element => {
                if (element.category && element.condition) {
                    if (element.category == param.category_id.name && element.condition._id.toString() == param.condition_id.toString()) {
                        if (flag == false) {
                            flag = true
                            compareString += 'true'
                        }
                    }
                }
            });
        }
        if (flag == false) {
            compareString += 'false'
        }
    });
    if (tag_id == "ble-pd-0C4314EF65DC") {
        console.log(compareString, "compareString")
    }
    if (isLocationCondition && eval(compareString) && compareString != "") {
        await Action.findOneAndUpdate(action._id, { locationcondition_id: localtionCondition })
        return false
    }
    if (eval(compareString) && compareString != "" && isLocationCondition == false) {
        return true
    } else {
        return false
    }
}

/**
 * Runs an action by sending a webhook to the specified webhook_id and using the supplied webHookData
 * @param {Object} action - The action to run
 * @param {Array} webHookData - The data to be sent with the webhook. Each element of the array should be an object with the following properties: tag_id, zone_id, message
 * @returns {Promise} - A promise that resolves when the webhook has been sent
 */

const runAction = async (action, webHookData, fitConditions = []) => {
    const eventType = await EventType.findById(action.eventType)
    const tagStatus = await TagStatus.findOne({ tag_id: webHookData[0].tag_id })
    const conditions = []
    eventType.params.forEach(async (param) => {
        const condition = await Condition.findById(param.condition_id)
        let battery_status = ''
        let fitCondition = {}
        if (fitConditions.length > 0) {
            fitCondition = fitConditions.filter((c) => c.condition._id.toString() == condition._id.toString())
            if (fitCondition.length > 0) {
                battery_status = fitCondition[0]['battery_status'];
            } else {
                return false;
            }
        }
        let conditionString = ''
        condition.conditions.map((c, i) => {
            const logic = c.param.logic_operator == "And" ? "&&" : "||"
            if (i != 0) {
                conditionString += logic + c.param + " " + c.operator + " " + c.standard_value
            } else {
                conditionString += c.param + " " + c.operator + " " + c.standard_value
            }
        })
        let data = {}
        if (battery_status != "") {
            data = {
                id: condition._id,
                name: condition.name,
                severity: condition.severity,
                parameters: tagStatus[condition.category],
                condition: conditionString,
                description: condition.description,
                event_id: fitCondition[0].event_id,
                status: battery_status
            }
        } else {
            data = {
                id: condition._id,
                name: condition.name,
                severity: condition.severity,
                parameters: tagStatus[condition.category],
                condition: conditionString,
                description: condition.description,
                event_id: fitCondition[0].event_id,
            }
        }
        conditions.push(data)
    })
    setTimeout(async () => {
        action.webHook.map(async (whook) => {
            if (whook == "") return false
            const webhook = await WebHookModel.findById(whook)
            if (webhook) {
                const data = {
                    'tag_id': webHookData[0].tag_id,
                    'zone_id': webHookData[0].zone_id,
                    'conditions': conditions
                }
                await runWebHook(webhook, data)
            }
        })
    }, 500);
}

async function checkTag(tag, type, period, area_id) {
    const category_conditions = await CategoryCondition.find({ type: "custom" }).populate('condition_id').populate('category_id')
    const zone = await Zone.findById(tag.zone_id)
    const actions = await Action.find({ status: 1, tag_id: tag.tag_id })
    let fitConditions = []
    let webHookData = []
    category_conditions.forEach(async (item) => {
        const condition = item.condition_id
        const category = item.category_id.name
        if (!condition.selectedZones.includes(tag.zone_id.toString())) return
        checkingTagConditions = [...checkingTagConditions, tag.tag_id + "_" + item.condition_id]
        const flag = await checkCustomCondition(tag, item.condition_id, item.category_id.name)
        let isTrue = false
        if (condition.checkingType == type) {
            isTrue = true
        }
        if (isTrue) {
            const string = condition.description
            if (tag.runConditions) {
                const runConditions = tag.runConditions.map((item) => {
                    return item.toString()
                })
                if (!flag && runConditions.includes(condition._id.toString()) && category == 'issue') {
                    let isCheck = true
                    if (isCheck) {
                        await TagStatus.findByIdAndUpdate(tag._id, {
                            runConditions: tag.runConditions.filter((item) => item.toString() != condition._id.toString()),
                        })
                        const ongoingTarget = tag.ongoingEvents.filter((ongoingEvent) => {
                            return ongoingEvent.condition_id == condition._id.toString()
                        })[0]
                        if (ongoingTarget) {
                            await Event.findByIdAndUpdate(ongoingTarget.event_id, { battery_status: "resolved", color: "green" })
                            await TagStatus.findByIdAndUpdate(tag._id, {
                                ongoingEvents: [tag.ongoingEvents.filter((ongoingEvent) => {
                                    return ongoingEvent.condition_id == condition._id.toString()
                                })],
                            })
                            const data = {
                                'tag_id': tag.tag_id,
                                'zone_id': tag.zone_id,
                            }
                            webHookData.push(data)
                            fitConditions.push({ condition: item.condition_id, category: item.category_id.name, battery_status: "resolved" })
                        }
                    }
                }
            }
            if (flag) {
                let event_id
                const runConditions = tag.runConditions.map((item) => {
                    return item.toString()
                })
                let isValid = false
                if (tag[`previous_${condition.category}`]) {
                    condition.conditions.forEach((param, index) => {
                        if (tag[condition.category][param.param] != tag[`previous_${condition.category}`][param.param]) {
                            isValid = true
                        }
                    })
                } else {
                    isValid = true
                }
                let isSameId = false
                if (isValid) {
                    let color = ""
                    if (condition.severity == "info") {
                        color = '#006FEE'
                    }
                    if (condition.severity == "warning") {
                        color = '#F5A524'
                    }
                    if (condition.severity == "error") {
                        color = '#F31260'
                    }
                    if (condition.severity == "critical") {
                        color = 'red'
                    }
                    if (runConditions && runConditions.includes(condition._id.toString())) {
                    } else {
                        await TagStatus.findByIdAndUpdate(tag._id, {
                            runConditions: [...tag.runConditions, condition._id],
                        })
                    }
                    let isAreaMatch = true
                    if (item.condition_id.selectedAreas.length > 0) {
                        if (item.condition_id.selectedAreas.includes(area_id)) {
                            isAreaMatch = true
                        } else {
                            isAreaMatch = false
                        }
                    }
                    let isTimeMatch = true
                    const date = new Date();
                    if (item.condition_id.start || item.condition_id.end) {
                        isTimeMatch = false
                        const hour = date.getHours()
                        const minute = date.getMinutes()
                        const [starthour, startminute] = item.condition_id.start.split(":").map(Number);
                        const [endhour, endminute] = item.condition_id.end.split(":").map(Number);
                        const currentTimeInMinutes = hour * 60 + minute;
                        const startTimeInMinutes = starthour * 60 + startminute;
                        const endTimeInMinutes = endhour * 60 + endminute;

                        if (startTimeInMinutes <= endTimeInMinutes) {
                            // Normal case: start time is before end time
                            isTimeMatch = currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes <= endTimeInMinutes;
                        } else {
                            // Edge case: start time is after end time (spanning midnight)
                            isTimeMatch = currentTimeInMinutes >= startTimeInMinutes || currentTimeInMinutes <= endTimeInMinutes;
                        }
                    }
                    console.log(isAreaMatch, "isAreaMatch")
                    console.log(isTimeMatch, "isTimeMatch")
                    if (isAreaMatch && isTimeMatch) {
                        if (category == 'issue') {
                            if (condition.tag_id) {
                                if (condition.tag_id == tag.tag_id) {
                                    isSameId = true
                                }
                            } else {
                                isSameId = true
                            }
                            if (isSameId) {
                                const newEvent = new Event({
                                    category: item.category_id.name,
                                    type: item.condition_id.name,
                                    object: tag.tag_id,
                                    zone: tag.zone_id,
                                    information: string,
                                    battery_status: "ongoing",
                                    color
                                });
                                const result = await newEvent.save();
                                event_id = result._id
                                if (runConditions && runConditions.includes(condition._id.toString())) {
                                } else {
                                    await TagStatus.findByIdAndUpdate(tag._id, {
                                        ongoingEvents: [...tag.ongoingEvents, { condition_id: condition._id, event_id: result._id }],
                                    })
                                }
                            }
                        } else {
                            if (condition.tag_id) {
                                if (condition.tag_id == tag.tag_id) {
                                    isSameId = true
                                }
                            } else {
                                isSameId = true
                            }
                            if (isSameId) {
                                const newEvent = new Event({
                                    category: item.category_id.name,
                                    type: item.condition_id.name,
                                    object: tag.tag_id,
                                    zone: tag.zone_id,
                                    information: string,
                                });
                                const result = await newEvent.save();
                                event_id = result._id
                            }
                        }
                    }
                }
                if (isValid && isSameId) {
                    const data = {
                        'tag_id': tag.tag_id,
                        'zone_id': tag.zone_id,
                        'message': flag
                    }
                    webHookData.push(data)
                    fitConditions.push({ condition: item.condition_id, category: item.category_id.name, battery_status: "ongoing", event_id: event_id })
                }
            }
        }
    })
    const zoneDetail = await Zone.findById(tag.zone_id)
    const currentTime = new Date();
    const tagTime = new Date(tag.time);
    const timeDifference = currentTime - tagTime;
    if (timeDifference < 5 * 60 * 1000 && (tag.status == 'lost' || tag.status == "no data")) {
        tag.status = 'good';
        await tag.save(); // Save the updated tag
    }
    if (timeDifference > 5 * 60 * 1000 && tag.status != 'no data' && tag.status != 'lost') {
        const category = "info";
        tag.status = 'no data'; // Update the status
        await tag.save(); // Save the updated tag
        const data = {
            'tag_id': tag.tag_id,
            'zone_id': tag.zone_id,
            'message': `Tag (${tag.tag_id}) sent no data on Zone(${tag.zone_id}, ${zoneDetail?.title})`
        }
        // broadcastToClients(data, "tag_nodata", "info")
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
        const result = await newEvent.save();
        const event_id = result._id
        const condition_id = await Condition.findOne({ name: "tag_nodata", type: "system", event_id: event_id })
        webHookData.push(data)
        fitConditions.push({ condition: condition_id, category: "info" })
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
        // broadcastToClients(data, "tag_lost", "info")
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
        const result = await newEvent.save();
        const event_id = result._id
        const condition_id = await Condition.findOne({ name: "tag_lost", type: "system" })
        webHookData.push(data)
        fitConditions.push({ condition: condition_id, category: "info", event_id: event_id })
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
        broadcastToClients(data)
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
        const result = await newEvent.save();
        const event_id = result._id
        const condition_id = await Condition.findOne({ name: "tag_detected", type: "system" })
        webHookData.push(data)
        fitConditions.push({ condition: condition_id, category: "info", event_id: event_id })
    }
    if (tag.manuf_data) {
        let is_new_battery = false
        if (tag.previous_manuf_data) {
            if (tag.manuf_data.vbatt != tag.previous_manuf_data.vbatt) {
                is_new_battery = true
            }
        } else {
            is_new_battery = true
        }
        if (is_new_battery) {
            const zone = await Zone.findById(tag.zone_id)
            let middle_standard = 2.99
            let low_standard = 2.3
            const category = "issue";
            let type = ""
            let battery_status = ""
            let color = ""
            let pre_battery_status = ""
            if (tag.manuf_data.vbatt >= middle_standard && tag.battery_status != "battery_good" && tag.status != 'no data' && tag.status != 'lost') {
                content = `battery(${tag.manuf_data.vbatt}) is good`
                type = "battery_good"
                if (tag.battery_status == 'battery_low' || tag.battery_status == 'battery_middle') {
                    battery_status = 'resolved'
                    color = "green"
                    pre_battery_status = ["battery_middle"]
                }
            }
            if (tag.manuf_data.vbatt < middle_standard && tag.manuf_data.vbatt >= low_standard && tag.battery_status != "battery_middle" && tag.status != 'no data' && tag.status != 'lost') {
                if (tag.battery_status == 'battery_low') {
                    battery_status = 'resolved'
                    color = "green"
                    pre_battery_status = ["battery_low"]
                }
                if (tag.battery_status == 'battery_good') {
                    battery_status = 'ongoing'
                    color = "#006FEE"
                }
                content = `battery(${tag.manuf_data.vbatt}) is middle`
                type = "battery_middle"
            }
            if (tag.manuf_data.vbatt < low_standard && tag.battery_status != "battery_low" && tag.status != 'no data' && tag.status != 'lost') {
                content = `battery(${tag.manuf_data.vbatt}) is low`
                type = "battery_low"
                if (tag.battery_status == 'battery_middle' || tag.battery_status == 'battery_good') {
                    battery_status = 'ongoing'
                    color = "#006FEE"
                }
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
                // broadcastToClients(data, type, "issue")
                let event_id
                tag.battery_status = type
                await tag.save();
                if (battery_status != "") {
                    if (battery_status == "ongoing") {
                        const newEvent = new Event({
                            category,
                            type,
                            object,
                            zone,
                            information,
                            battery_status,
                            color
                        });
                        const result = await newEvent.save();
                        event_id = result._id
                        await TagStatus.findByIdAndUpdate(tag._id, {
                            ongoingEvents: [...tag.ongoingEvents, { condition_id: type, event_id: result._id }],
                        })
                    }
                    if (battery_status == "resolved") {
                        if (type == "battery_middle") {
                            const newEvent = new Event({
                                category,
                                type,
                                object,
                                zone,
                                information,
                                battery_status: "ongoing",
                                color
                            });
                            const result = await newEvent.save();
                            event_id = result._id
                            await TagStatus.findByIdAndUpdate(tag._id, {
                                ongoingEvents: [...tag.ongoingEvents, { condition_id: type, event_id: result._id }],
                            })
                        }
                        const ongoingTarget = tag.ongoingEvents.filter((ongoingEvent) => {
                            return pre_battery_status.includes(ongoingEvent.condition_id)
                        })[0]
                        if (ongoingTarget) {
                            await Event.findByIdAndUpdate(ongoingTarget.event_id, { battery_status: "resolved", color })
                            await TagStatus.findByIdAndUpdate(tag._id, {
                                ongoingEvents: [tag.ongoingEvents.filter((ongoingEvent) => {
                                    return ongoingEvent.condition_id == type
                                })],
                            })
                        }
                    }
                } else {
                    const newEvent = new Event({
                        category,
                        type,
                        object,
                        zone,
                        information
                    });
                    const result = await newEvent.save();
                    event_id = result._id
                }
                const condition_id = await Condition.findOne({ name: type, type: "system" })
                webHookData.push(data)
                fitConditions.push({ condition: condition_id, category: "issue", battery_status: battery_status, event_id: event_id })
            }
        }
    }
    const globalActions = await Action.find({ status: 1, global: true })
    await actions.forEach(async (action) => {
        const result = await checkActionWithConditions(tag.tag_id, action, fitConditions)
        if (result) {
            if (action.count > 0 && action.executionType == "once") {
                return false
            }
            await runAction(action, webHookData, fitConditions)
        }
    });
    await globalActions.forEach(async (action) => {
        const result = await checkActionWithConditions(tag.tag_id, action, fitConditions)
        if (result) {
            await runAction(action, webHookData, fitConditions)
        }
    });
    checkingTags = checkingTags.filter((item) => item !== tag.tag_id)
    if (tag.isCheckingAOA) {
        await TagStatus.updateOne({ tag_id: tag.tag_id }, { isCheckingAOA: false })
    }
    if (tag.isCheckingPosition) {
        await TagStatus.updateOne({ tag_id: tag.tag_id }, { isCheckingPosition: false })
    }
    if (tag.isCheckingManuf) {
        await TagStatus.updateOne({ tag_id: tag.tag_id }, { isCheckingManuf: false })
    }
}

async function checkTagStatus(minute) {
    const tags = await TagStatus.find({ zone_id: { $ne: null } })
    tags.forEach(async (tag) => {
        if (!checkingTags.includes(tag.tag_id)) {
            checkingTags = [...checkingTags, tag.tag_id]
            await checkTag(tag, "every-minute", minute, null)
        }
    })
}

let minute = 0

const checkEveryMinute = async () => {
    minute++
    checkTagStatus(minute)
}

const eventCountPerZoneCategory = async () => {
    const zones = await Zone.find()
    const categories = await Category.find()
    const oneMinutesAgo = new Date(Date.now() - 60 * 1000);
    zones.map((zone) => {
        categories.map(async (category) => {
            const count = await Event.countDocuments({ zone: zone._id, category: category.name, createdAt: { $gte: oneMinutesAgo } })
            if (count > 0) {
                const ongoing_count = await Event.countDocuments({ zone: zone._id, category: category.name, createdAt: { $gte: oneMinutesAgo }, battery_status: 'ongoing' })
                const resolved_count = await Event.countDocuments({ zone: zone._id, category: category.name, createdAt: { $gte: oneMinutesAgo }, battery_status: 'resolved' })
                const infoOngoingCount = await Event.countDocuments({ createdAt: { $gte: oneMinutesAgo }, zone: zone._id, battery_status: "ongoing", color: "#006FEE", category: "issue" })
                const warningOngoingCount = await Event.countDocuments({ createdAt: { $gte: oneMinutesAgo }, zone: zone._id, battery_status: "ongoing", color: "#F5A524", category: "issue" })
                const errorOngoingCount = await Event.countDocuments({ createdAt: { $gte: oneMinutesAgo }, zone: zone._id, battery_status: "ongoing", color: "#F31260", category: "issue" })
                const criticalOngoingCount = await Event.countDocuments({ createdAt: { $gte: oneMinutesAgo }, zone: zone._id, battery_status: "ongoing", color: "red", category: "issue" })
                const data = {
                    zone: zone._id,
                    category: category.name,
                    count: count,
                    ongoing: ongoing_count,
                    resolved: resolved_count,
                    datetime: oneMinutesAgo,
                    info: infoOngoingCount,
                    warning: warningOngoingCount,
                    error: errorOngoingCount,
                    critical: criticalOngoingCount
                }
                await EventCount.create(data);
            }
        })
    })
}

const assetEventCountPerZoneCategory = async () => {
    const zones = await Zone.find()
    const assets = await Asset.find()
    const tagIds = assets.map(asset => asset._id.tag)
    const categories = await Category.find()
    const oneMinutesAgo = new Date(Date.now() - 60 * 1000);
    zones.map((zone) => {
        categories.map(async (category) => {
            const count = await Event.countDocuments({ zone: zone._id, category: category.name, createdAt: { $gte: oneMinutesAgo }, object: { $in: tagIds } })
            if (count > 0) {
                const ongoing_count = await Event.countDocuments({ zone: zone._id, category: category.name, createdAt: { $gte: oneMinutesAgo }, battery_status: 'ongoing', object: { $in: tagIds } })
                const resolved_count = await Event.countDocuments({ zone: zone._id, category: category.name, createdAt: { $gte: oneMinutesAgo }, battery_status: 'resolved', object: { $in: tagIds } })
                const infoOngoingCount = await Event.countDocuments({ createdAt: { $gte: oneMinutesAgo }, zone: zone._id, battery_status: "ongoing", color: "#006FEE", category: "issue", object: { $in: tagIds } })
                const warningOngoingCount = await Event.countDocuments({ createdAt: { $gte: oneMinutesAgo }, zone: zone._id, battery_status: "ongoing", color: "#F5A524", category: "issue", object: { $in: tagIds } })
                const errorOngoingCount = await Event.countDocuments({ createdAt: { $gte: oneMinutesAgo }, zone: zone._id, battery_status: "ongoing", color: "#F31260", category: "issue", object: { $in: tagIds } })
                const criticalOngoingCount = await Event.countDocuments({ createdAt: { $gte: oneMinutesAgo }, zone: zone._id, battery_status: "ongoing", color: "red", category: "issue", object: { $in: tagIds } })
                const data = {
                    zone: zone._id,
                    category: category.name,
                    count: count,
                    ongoing: ongoing_count,
                    resolved: resolved_count,
                    datetime: oneMinutesAgo,
                    info: infoOngoingCount,
                    warning: warningOngoingCount,
                    error: errorOngoingCount,
                    critical: criticalOngoingCount
                }
                await AssetEventCount.create(data);
            }
        })
    })
}

setInterval(() => {
    checkEveryMinute()
    eventCountPerZoneCategory()
    assetEventCountPerZoneCategory()
}, 60 * 1000);

module.exports = {
    checkEvent
};
