/** @satisfies {import('@webcontainer/api').FileSystemTree} */




const tcprelay = `

import net from 'net';
import rawr from 'rawr';
import { EventEmitter } from 'events';
// import readline from 'readline';

const sockets = {};
const transport = new EventEmitter();

console.log('firing up tcprelay');

const getMsg = \`GET / HTTP/1.1
User-Agent: Mozilla/4.0 (compatible; MSIE5.01; Windows NT)
Host: localhost
Accept-Language: en-us
Accept-Encoding: gzip, deflate
Connection: Keep-Alive

\`;

// setTimeout(() => {
//   const sock1 = new net.Socket();
//   sock1.connect(9000, 'localhost', () => {
//     console.log('simple web connected to 9000');
//     sock1.write(getMsg);
//     // sock1.write('blah blah');
//     setInterval(() => {
//       console.log('writing random');
//       sock1.write('blah' + Math.random());
//     }, 2000);
//     console.log('wrote basicGet', getMsg);
//   });
//   sock1.on('data', (data) => {
//     console.log('data from 9000', data.toString());
//   });
//   sock1.on('close', () => {
//     console.log('close from 9000');
//   });
//   sock1.on('error', (err) => {
//     console.log('error from 9000', err);
//   });
//   console.log('started sock1');
// }, 3000);

// const rl = readline.createInterface(process.stdin, process.stdout);

transport.send = (data) => {
  // console.log('tcprelay send', data);
  // input.write();
  const output = String(JSON.stringify(data));
  process.stdout.write(output);
};

process.stdin.on('data', (data) => {
  // console.log('ondata', data.toString());
  try {
    const obj = JSON.parse(('' + data.toString()).trim());
    console.log('parsed obj', obj);
    transport.emit('rpc', obj);
  } catch (e) {
  }
  // data = data.toString().toUpperCase();
  // process.stdout.write(data);
});

// rl.on('line', (line) => {
//   try {
//     const obj = JSON.parse(('' + line).trim());
//     transport.emit('rpc', obj);
//   } catch (e) {
//     // console.warn(e);
//   }
// });

function connect(port, host, socketId) {
  console.log('connecting', port, host, socketId);
  const socket = new net.Socket();
  socket.id = socketId;
  sockets[socketId] = socket;
  socket.on('data', (data) => {
    // console.log('data from linux socket', data.toString(), typeof data);
    try {
      const aData = data.toString('base64');
      // console.log('sending data', data, aData);
      peer.notifiers.data(socket.id, aData);
    } catch (e) {
      console.warn('error relaying data back to ', e);
    }
  });
  return new Promise((resolve, reject) => {
    socket.connect(port, host, () => {
      console.log('connected!', socket.id);
      resolve({ ok: 'ok', socketId });
    });
  });
}

function write(socketId, data) {
  const socket = sockets[socketId];
  if (socket) {
    socket.write(atob(data));
  }
  return { ok: 'ok' };
}

const peer = rawr({ transport, methods: { connect, write } });

peer.notifications.onwrite((socketId, data) => {
  console.log('relay got data', socketId, data);
  if (sockets[socketId]) {
    console.log('socket available', socketId);
    sockets[socketId].write(atob(data));
  }
});

  console.log('tcprelay started');
`;



const echoserver = `
import net from 'net';

const PORT = 9000;

const socketServer = net.createServer(async (socket) => {
  socket.on('data', async (data) => {
    console.log('received', data.toString());
    socket.write(Buffer.from('back atcha, ' + data.toString()));
    // socket.close();
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

`;

const expressclient = `
import net from 'net';

const PORT = 3000;

const getMsg = \`GET / HTTP/1.1
User-Agent: Mozilla/4.0 (compatible; MSIE5.01; Windows NT)
Host: localhost
Accept-Language: en-us
Accept-Encoding: gzip, deflate
Connection: Keep-Alive

\`;


const socket = new net.Socket();
socket.connect(PORT, 'localhost', () => {
  console.log('connected to', PORT);
  socket.on('data', (data) => {
    console.log('data from server', data.toString());
  });
  socket.write(getMsg);
});

`

const expressserver = `
import express from 'express';
const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('Welcome to a WebContainers app! 🥳');
});

app.listen(port, () => {
  console.log(\`App is live at http://localhost:\${port}\`);
});

`;

const packagejson = `
{
  "name": "example-app",
  "type": "module",
  "dependencies": {
    "express": "latest",
    "nodemon": "latest",
    "rawr": "latest"
  },
  "scripts": {
    "start": "nodemon --watch './' index.js"
  }
}
`;

export const files = {
  'index.js': {
    file: {
      contents: expressserver,
    },
  },
  'package.json': {
    file: {
      contents: packagejson,
    },
  },
  'tcprelay.js': {
    file: {
      contents: tcprelay,
    },
  },
  'echoserver.js': {
    file: {
      contents: echoserver,
    },
  },
  'expressclient.js': {
    file: {
      contents: expressclient,
    },
  },
};
