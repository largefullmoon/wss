const WebSocket = require('ws');

 async function websockets(expressServer, wsPath) {
  const websocketServer = new WebSocket.Server({
    noServer: true,
    path: "/" + wsPath,
  });
  console.log("websocketServer started on ", wsPath)
  expressServer.on("upgrade", (request, socket, head) => {
    console.log("upgrade request")
    websocketServer.handleUpgrade(request, socket, head, (websocket) => {
      websocketServer.emit("connection", websocket, request);
    });
  });

  websocketServer.on(
    "connection",
    function connection(websocketConnection, connectionRequest) {
        websocketServer.on('error', console.error);

      console.log("connected to websocket");
      const [_path, params] = connectionRequest?.url?.split("?");

      websocketConnection.on("message", (message) => {
        const parsedMessage = JSON.parse(message);
        console.log(parsedMessage);
        websocketConnection.send(JSON.stringify({ message: 'There be gold in them thar hills.' }));
      });
    }
  );

  return websocketServer;
};


module.exports = websockets;