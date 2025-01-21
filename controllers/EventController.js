
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
        pass: 'gbuv hcjk eudg amho',
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
        console.log("receive pong from client");
    });

    ws.on('close', () => {
        clearInterval(interval); // Clear interval when the client disconnects
    });
    clients.push(ws)
});
const runWebHook = async (webHook, data) => {
    if (webHook.type == "email") {
        const text = ""
        const mailOptions = {
            from: 'alerts@cotrax.io',
            to: webHook.email,
            subject: 'Alert from Cotrax',
            text: text,
            html: `<b>${text}</b>`,
        };
        transporter.sendMail(mailOptions, async (error, info) => {
            if (error) {
                await WebHookModel.updateOne({ _id: webHook._id }, { failcount: webHook.failcount + 1 })
            } else {
                await WebHookModel.updateOne({ _id: webHook._id }, { sentcount: webHook.sentcount + 1 })
            }
        });
    }
    if (webHook.type == "dashboard_notification") {
        broadcastToClients({ ...data, message: webHook.message })
        await Notification.create({ tag_id: data.tag_id, zone_id: data.zone_id, message: webHook.message, readUserIds: [] })
        await WebHookModel.updateOne({ _id: webHook._id }, { sentcount: webHook.sentcount + 1 })
    }
    if (webHook.type == "webhook") {
        try {
            const isURLParams = webHook.isURLParams;
            let params = webHook?.params;
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
                            urlParamsData[urlParams[i].key] = zone.name;
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
            console.log(isURLParams)
            console.log(postData)
            console.log(webHook.webhookUrl)
            if (isURLParams) {
                const params = new URLSearchParams(postData).toString();
                const response = await axios.get(`${webHook.webhookUrl}?${params}`);
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
}
const redis = require('redis');
const { CategoryCondition } = require('../models/CategoryCondition.js');
const { Category } = require('../models/Category.js');
const { Condition } = require('../models/Condition.js');
const EventCount = require('../models/EventCount.js');
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

async function checkEvent(event, zone_id, areas, ws) {
    const tagInfo = JSON.parse(event)
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
            if (assets.filter(asset => asset.tag == tagInfo.tag_id)[0]) {
                const previousdata = await AssetStatus.find({ tag_id: tagInfo.tag_id, zone_id: zone_id, startTime: { $exists: true }, stopTime: { $exists: false } }).sort({ createdAt: -1 });
                if (previousdata.length > 0) {
                } else {
                    if (statuses.filter(status => status.tag_id == tagInfo.tag_id && status.zone_id == zone_id).length == 0) {
                        statuses.push({
                            tag_id: tagInfo.tag_id,
                            zone_id: zone_id
                        })
                        const assetstatus = new AssetStatus({
                            asset_id: assets.filter(asset => asset.tag == tagInfo.tag_id)[0]?._id,
                            tag_id: tagInfo.tag_id,
                            zone_id: zone_id,
                            startTime: new Date(),
                            movement_status: tagInfo.movement_status
                        })
                        await assetstatus.save()
                    }
                }
            }
        } else {
            if (assets.filter(asset => asset.tag == tagInfo.tag_id)[0]) {
                const previousdatas = await AssetStatus.find({ tag_id: tagInfo.tag_id, zone_id: zone_id, startTime: { $exists: true }, stopTime: { $exists: false } }).sort({ createdAt: -1 });
                statuses = statuses.filter(status => !status.tag_id == tagInfo.tag_id && status.zone_id == zone_id)
                previousdatas.map(async (previousdata) => {
                    if (previousdata && previousdata.movement_status == 0) {
                        previousdata.stopTime = new Date()
                        previousdata.movement_status = tagInfo.movement_status
                        await previousdata.save()
                    }
                })
            }
        }
        // AssetStatus
    }
    if (tagInfo.type == "position_data") {
        for (let i = 0; i < areas.length; i++) {
            const currentStatus = await getDeviceInfo(tagInfo.tag_id);
            if (areas[i].top_right.x >= tagInfo.x && areas[i].top_right.y >= tagInfo.y && areas[i].bottom_left.x <= tagInfo.x && areas[i].bottom_left.y <= tagInfo.y) {
                if ((currentStatus?.status != "out" && currentStatus?.status != "in") || (currentStatus?.status == 'out') || (currentStatus?.status == 'in' && currentStatus?.area != areas[i]._id.toString())) {
                    if (assets.filter(asset => asset.tag == tagInfo.tag_id)[0]) {
                        const previousdata = await AssetPosition.find({ tag_id: tagInfo.tag_id, zone_id: zone_id, area_id: areas[i]._id, enterTime: { $exists: true }, exitTime: { $exists: false } }).sort({ createdAt: -1 });
                        if (previousdata > 0) {

                        } else {
                            if (positions.filter(position => position.tag_id == tagInfo.tag_id && position.zone_id == zone_id).length == 0) {
                                positions.push({
                                    tag_id: tagInfo.tag_id,
                                    zone_id: zone_id
                                })
                                const assetposition = await AssetPosition({
                                    asset_id: assets.filter(asset => asset.tag == tagInfo.tag_id)[0]?._id,
                                    tag_id: tagInfo.tag_id,
                                    zone_id: zone_id,
                                    area_id: areas[i]._id,
                                    enterTime: new Date()
                                })
                                await assetposition.save()
                            }
                        }
                    }
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
                        'area_id': area,
                        'area_name': tagInfo.tag_id,
                        'message': `Tag (${tagInfo.tag_id}) cross in Area (${areas[i]._id} ${areas[i].desc ? "," + areas[i].desc : ""})`,
                    }
                    // broadcastToClients(data, "tag_entered_area", "location")
                    const tag = await TagStatus.findOne({ tag_id: tagInfo.tag_id })
                    const actions = await Action.find({ status: 1, tag_id: tag.tag_id }).populate('locationcondition_id')
                    actions.forEach(action => {
                        if (action.locationcondition_id) {
                            if (action.locationcondition_id.name == 'tag_entered_area') {
                                runAction(action, [data])
                            }
                        }
                    });
                }
            } else {
                if (currentStatus?.status == 'in' && currentStatus?.area == areas[i]._id.toString()) {
                    const assetpositions = await AssetPosition.find({ tag_id: tagInfo.tag_id, zone_id: zone_id, area_id: areas[i]._id, enterTime: { $exists: true }, exitTime: { $exists: false } }).sort({ createdAt: -1 });
                    positions = positions.filter(position => !position.tag_id == tagInfo.tag_id && position.zone_id == zone_id)
                    assetpositions.map(async (assetposition) => {
                        assetposition.exitTime = new Date();
                        await assetposition.save()
                    })
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
                    // broadcastToClients(data, "tag_exited_area", "location")
                    const tag = await TagStatus.findOne({ tag_id: tagInfo.tag_id })
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
    const tagStatus = await TagStatus.findOne({ tag_id: tagInfo.tag_id })
    if (tagStatus) {
        if (!checkingTags.includes(tagStatus.tag_id)) {
            checkingTags = [...checkingTags, tagStatus.tag_id]
            await checkTag(tagStatus, "real-time", null)
        }
    }
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
                compareString += logic_ope + tag[condition.category][param.param] + param.operator + param.standard_value
            })
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

const checkActionWithConditions = async (action, conditions) => {
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
                if (element.category == param.category_id.name && element.condition._id.toString() == param.condition_id.toString()) {
                    if (flag == false) {
                        flag = true
                        compareString += 'true'
                    }
                }
            });
        }
        if (flag == false) {
            compareString += 'false'
        }
    });
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
        if (fitConditions.length > 0) {
            const fitCondition = fitConditions.filter((c) => c.condition._id.toString() == condition._id.toString())
            if (fitCondition) {
                battery_status = fitCondition[0]['battery_status']
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
            }
        }
        conditions.push(data)
    })
    setTimeout(async () => {
        action.webHook.map(async (whook) => {
            const webhook = await WebHookModel.findById(whook)
            const data = {
                'tag_id': webHookData[0].tag_id,
                'zone_id': webHookData[0].zone_id,
                'conditions': conditions
            }
            await runWebHook(webhook, data)
        })
    }, 500);
}

async function checkTag(tag, type, period) {
    console.log(Category, "Category")
    console.log(Condition, "Condition")
    const category_conditions = await CategoryCondition.find({ type: "custom" }).populate('condition_id').populate('category_id')
    const zone = await Zone.findById(tag.zone_id)
    const actions = await Action.find({ status: 1, tag_id: tag.tag_id })
    let fitConditions = []
    let webHookData = []
    category_conditions.forEach(async (item) => {
        if (checkingTagConditions.includes(tag.tag_id + "_" + item.condition_id)) return
        const condition = item.condition_id
        const category = item.category_id.name
        if (!condition.selectedZones.includes(tag.zone_id.toString())) return
        checkingTagConditions = [...checkingTagConditions, tag.tag_id + "_" + item.condition_id]
        const flag = await checkCustomCondition(tag, item.condition_id, item.category_id.name)
        // if (condition.checkingType == type) {
        let isTrue = true
        if (condition.checkingType == "every-minute" && (period % condition.checkingPeriod) == 0) {
            isTrue = true
        } else {
            isTrue = false
        }
        if (condition.checkingType == "real-time") {
            isTrue = true
        }
        if (isTrue) {
            const string = condition.description
            // let string = ""
            // if (message != null && message != "") {
            //     const preString = "`" + message + "`"
            //     let params = {}
            //     if (tag.aoa) {
            //         params = { ...params, ...tag.aoa }
            //     }
            //     if (tag.manuf_data) {
            //         params = { ...params, ...tag.manuf_data }
            //     }
            //     if (tag.position) {
            //         params = { ...params, ...tag.position }
            //     }
            //     try {
            //         string = new Function(`
            //             const tag={id:'${tag?.tag_id}'};
            //             const zone={id:'${tag?.zone_id}',name:'${zone?.title}',description:'${zone?.description}'};
            //             const param = ${JSON.stringify(params)};
            //             return ${preString};
            //         `)();
            //     } catch (error) {
            //         console.log(error)
            //     }
            // }
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
                if (!runConditions.includes(condition._id.toString())) {
                    isValid = true
                }
                if (isValid) {
                    await TagStatus.findByIdAndUpdate(tag._id, {
                        previous_aoa: tag.aoa,
                        previous_manuf_data: tag.manuf_data,
                        previous_position: tag.position,
                    })
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
                    if (category == 'issue') {
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
                        if (runConditions && runConditions.includes(condition._id.toString())) {
                        } else {
                            await TagStatus.findByIdAndUpdate(tag._id, {
                                ongoingEvents: [...tag.ongoingEvents, { condition_id: condition._id, event_id: result._id }],
                            })
                        }
                    } else {
                        const newEvent = new Event({
                            category: item.category_id.name,
                            type: item.condition_id.name,
                            object: tag.tag_id,
                            zone: tag.zone_id,
                            information: string,
                        });
                        await newEvent.save();
                    }
                }
                const data = {
                    'tag_id': tag.tag_id,
                    'zone_id': tag.zone_id,
                    'message': flag
                }
                webHookData.push(data)
                fitConditions.push({ condition: item.condition_id, category: item.category_id.name, battery_status: "ongoing" })
            }
        }
        // }
        checkingTagConditions = checkingTagConditions.filter(item => item != tag.tag_id + "_" + item.condition_id)
    })
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
        await newEvent.save();
        const condition_id = await Condition.findOne({ name: "tag_nodata", type: "system" })
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
        await newEvent.save();
        const condition_id = await Condition.findOne({ name: "tag_lost", type: "system" })
        webHookData.push(data)
        fitConditions.push({ condition: condition_id, category: "info" })
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
        // broadcastToClients(data, "tag_detected", "info")
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
        const condition_id = await Condition.findOne({ name: "tag_detected", type: "system" })
        webHookData.push(data)
        fitConditions.push({ condition: condition_id, category: "info" })
    }
    if (tag.manuf_data) {
        const zone = await Zone.findById(tag.zone_id)
        let middle_standard = 3.0
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
        if (tag.manuf_data.vbatt >= low_standard && tag.battery_status != "battery_middle" && tag.status != 'no data' && tag.status != 'lost') {
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
                await newEvent.save();
            }
            const condition_id = await Condition.findOne({ name: type, type: "system" })
            webHookData.push(data)
            fitConditions.push({ condition: condition_id, category: "issue", battery_status: battery_status })
        }
    }
    await actions.forEach(async (action) => {
        const result = await checkActionWithConditions(action, fitConditions)
        if (result) {
            await runAction(action, webHookData, fitConditions)
        }
    });
    checkingTags = checkingTags.filter((item) => item !== tag.tag_id)
}

async function checkTagStatus(minute) {
    const tags = await TagStatus.find()
    tags.forEach(async (tag) => {
        if (!checkingTags.includes(tag.tag_id)) {
            checkingTags = [...checkingTags, tag.tag_id]
            await checkTag(tag, "every-minute", minute)
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
