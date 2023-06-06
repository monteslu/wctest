const net = require('net');

const PORT = 9000;

const socketServer = net.createServer(async (socket) => {
  socket.on('data', async (data) => {
    console.log('received', data.toString());
    socket.write(Buffer.from('back atcha, ' + data.toString()));
  });

  socket.on('close', () => {
    console.log('closed');
  });

  socket.on('error', (error) => {
    console.log('error', error);
  });

});

socketServer.listen(PORT);

console.log('echo server listening on', PORT);

setTimeout(() => {
  const socket = net.connect(PORT);
  socket.on('data', (data) => {
    console.log('client received', data.toString());
  });
  socket.on('close', () => {
    console.log('client closed');
  });
  socket.on('error', (error) => {
    console.log('client error', error);
  });
  socket.write(Buffer.from('hello'));
  // socket.end();
}, 1000);