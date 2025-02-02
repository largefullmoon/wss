const mqtt = require('mqtt');

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



class AntennaMQTTClient {
    constructor(brokerUrl, baseTopic, bufferSize) {
        this.brokerUrl = brokerUrl;
        this.baseTopic = baseTopic;
        this.client = mqtt.connect(this.brokerUrl);
        this.buffers = {}; // Stores rolling buffers for each antenna's tagId
        //
        this.previousData = {}; // Stores previous data for each antenna
        this.bufferSize = bufferSize; // Fixed size for the rolling buffer
        this.loopActive = true;
        this.client.on('connect', () => {
            console.log('Connected to broker');
            this.subscribeToTopic();
        });

        this.client.on('message', (topic, message) => {
            this.processData(topic, message);
        });
    }

    async runTask() {
        while (this.loopActive) {
            await this.processBuffers();
            await this.wait(2000); // slowmo
        }
    }

    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    subscribeToTopic() {
        const topic = `${this.baseTopic}/#`;
        this.client.subscribe(topic, (err) => {
            if (err) {
                console.error('Failed to subscribe to topic', err);
            } else {
                console.log(`Subscribed to topic ${topic}`);
            }
        });
    }

    processData(topic, message) {
        try {
            const parsedData = JSON.parse(message.toString());
            const parts = topic.split('/');
            const tagId = parts[parts.length - 1];
            if (tagId == "ble-pd-0C4314F4632C")
                console.log(`Received data for tag ${tagId} on topic ${topic}:`, parsedData);
            if (!this.previousData[tagId]) {
                this.previousData[tagId] = new TagBuffer()
            }

            if (!this.buffers[tagId]) {
                this.buffers[tagId] = new ProcessingBuffer(this.bufferSize);
            }
            const lastDataString = JSON.stringify(this.previousData[tagId].getLast());
            const parsedDataString = JSON.stringify(parsedData);

            if (lastDataString !== parsedDataString) {
                this.buffers[tagId].add(parsedData);
                this.previousData[tagId].add(parsedData);
                console.log(`Data for tag ${tagId} changed, added to buffer. Buffer:`, parsedData, this.buffers[tagId].getBuffer());
            } else {
                console.log(`Data for tag ${tagId} did not change`);
            }
        } catch (error) {
            console.error(`Failed to process data from ${topic}`, error);
        }
    }
    async processBuffers() {
        const keys = Object.keys(this.buffers);

        keys.forEach((key) => {
            // console.log(`Processing buffer for tagId: ${key}`);
            // console.log(this.buffers[key].getFirst());
            // console.log('Buffer content:', this.buffers[key].getBuffer());
        });
    }
}

const brokerUrl = 'mqtt://185.61.139.41';
const baseTopic = 'fam/manuf_data';
const bufferSize = 10; // buff size
const mqttClient = new AntennaMQTTClient(brokerUrl, baseTopic, bufferSize);
mqttClient.runTask()
