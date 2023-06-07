import { EventEmitter } from 'events';
import rawr from 'rawr';
import b64Id from 'b64id';


export default async function createNet(webcontainerInstance) {

  const events = new EventEmitter();
  const listeners = {};
  const sockets = {};

  const transport = new EventEmitter();

  async function tcprelay() {
    await webcontainerInstance.spawn('node', ['echoserver.js']);
    const shellProcess = await webcontainerInstance.spawn('node', ['tcprelay.js']);
    shellProcess.output.pipeTo(
      new WritableStream({
        write(rawData) {
          console.log('FROM RELAY:', rawData);
          try {
            const data = JSON.parse(('' + rawData).trim());
            if (data && (data.method || (data.id && ('result' in data || 'error' in data)))) {
              transport.emit('rpc', data);
            }
          } catch (e) {
            // console.warn(e);
          }
        },
      })
    );
  
    const input = shellProcess.input.getWriter();
    transport.send = (data) => {
      console.log('to tcprelay', data);
      input.write(JSON.stringify(data) + '\n');
    };
  
    return shellProcess;
  };

  await tcprelay();
  const peer = rawr({ transport });

  peer.notifications.ondata((socketId, data) => {
    const socket = sockets[socketId];
    console.log('browser got data', socketId, data);
    if (socket) {
      socket.emit('data', atob(data));
    }
  });

  peer.notifiers.on('close', (socketId) => {
    const socket = sockets[socketId];
    if (socket) {
      socket.emit('close', {});
      delete sockets[socketId];
    }
  });

  function Socket() {
    const socket = new EventEmitter();
    socket.id = b64Id.generateId();
    sockets[socket.id] = socket;
    socket.connect = async function(port, host, clientCallback) {
      try {
        const result = await peer.methods.connect(port, host, socket.id);
        console.log('connected to linux port!', result);
        if (clientCallback) {
          clientCallback();
        }
      } catch (e) {
        console.warn(e);
        socket.emit('error', e);
        delete sockets[socket.id];
      }
    }

    socket.write = function(message) {
      // if (socket.serverSocket) {
      //   socket.serverSocket.emit('data', message);
      // }
      peer.notifiers.write(socket.id, btoa(message));
    };

    socket.end = async function(clientCallback) {
      // if (socket.serverSocket) {
      //   socket.serverSocket.emit('close');
      // }
      try {
        await peer.methods.end(socket.id);
        if (clientCallback) {
          clientCallback();
        }
      } catch (e) {
        console.warn(e);
        socket.emit('error', e);
      }
      delete sockets[socket.id];
    }

    return socket;
  }

  function createServer(cb) {
    const server = new EventEmitter();
    server.listen = (port) => {
      // debug('server.listen', port);
      listeners['l' + port] = server;
      events.on('socket_connect_' + port, ({ clientSocket, clientCallback }) => {
        // debug('socket_connect_' + port, clientSocket);
        const serverSocket = new EventEmitter();
        clientSocket.serverSocket = serverSocket;
        if (server.cb) {
          server.cb(serverSocket);
        }
        serverSocket.write = (data) => {
          clientSocket.emit('data', data);
        }
        serverSocket.end = () => {
          clientSocket.emit('close');
        }
        
        if (clientCallback) {
          clientCallback();
        }
      });
    };
    server.cb = cb;
    return server;
  }

  return {
    Socket,
    createServer,
    events,
  };
};
