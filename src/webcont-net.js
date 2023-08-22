import { EventEmitter } from 'events';
import rawr from 'rawr';
import b64Id from 'b64id';

export default async function createNet(webcontainerInstance, shellPort = 2323) {
  
  const events = new EventEmitter();
  const listeners = {};
  const sockets = {};

  const transport = new EventEmitter();

  async function tcprelay() {
    // await webcontainerInstance.spawn('node', ['echoserver.js']);
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
  
    shellProcess.inputWriter = shellProcess.input.getWriter();
    transport.send = (data) => {
      console.log('to tcprelay', data);
      if (!shellProcess.inputWriter) {
        shellProcess.inputWriter = shellProcess.input.getWriter();
      }
      shellProcess.inputWriter.write(JSON.stringify(data) + '\n');
    };
  
    return shellProcess;
  };

  await tcprelay();
  const peer = rawr({ transport });

  peer.notifications.ondata((socketId, data) => {
    const socket = sockets[socketId];
    console.log('browser got data', socketId, typeof data, data, Buffer.from(data, 'base64').toString('utf-8'));
    if (socket) {
      socket.emit('data', Buffer.from(data, 'base64')); //atob(data));
    }
  });

  peer.notifiers.onclose((socketId) => {
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
        if (port === shellPort) {
          const t1Stream = new WritableStream({
            write(data) {
              // terminal.write(data);
              // do what with the data?
              console.log('data from shell', data);
              socket.emit('data', data); //atob(data));
            },
          });
          const shellProcess = await webcontainerInstance.spawn('jsh');
          shellProcess.output.pipeTo(t1Stream);
          
          socket.shellProcess = shellProcess;
          socket.shellPort = port;
          // const input = shellProcess.input.getWriter();
          // terminal.onData((data) => {
          //   input.write(data);
          // });
        
          // return shellProcess;

        } else {
          const result = await peer.methods.connect(port, host, socket.id);
          console.log('connected to linux port!', result);
        }
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
      // console.log('WEBCONT-NET socket.write bin', message);
      console.log('WEBCONT-NET socket.write utf8', Buffer.from(message).toString('utf-8'));
      // console.log('WEBCONT-NET socket.write b64', Buffer.from(message).toString('base64'));
      // console.log('WEBCONT-NET socket.write btoa', btoa(message));
      if (socket.shellProcess) {
        console.log('writing to shell process', message);
        const str = new TextDecoder().decode(message);
        if (!socket.shellProcess.inputWriter) {
          socket.shellProcess.inputWriter = socket.shellProcess.input.getWriter();
        }
        socket.shellProcess.inputWriter.write(str);
      } else {
        peer.notifiers.write(socket.id, btoa(message));
      }
    };

    socket.end = async function(clientCallback) {
      console.log('socket.end', clientCallback);
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
          console.log('EMITTING DATA', data);
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
