// lib/clickhouse.js

const { createClient } = require('@clickhouse/client');

// Set up the ClickHouse client
const clickhouse = createClient({
  host: 'http://185.61.139.42:8999',
  username: 'dashboard',
  password: '3M6QqY+1',
  database: 'events',
});

module.exports = clickhouse;
