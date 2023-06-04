/** @satisfies {import('@webcontainer/api').FileSystemTree} */

export const files = {
  'index.js': {
    file: {
      contents: `
import express from 'express';
const app = express();
const port = 3111;

app.get('/', (req, res) => {
  res.send('Welcome to a WebContainers app! 🥳');
});

app.listen(port, () => {
  console.log(\`App is live at http://localhost:\${port}\`);
});

`,
    },
  },
  'package.json': {
    file: {
      contents: `
{
  "name": "example-app",
  "type": "module",
  "dependencies": {
    "express": "latest",
    "nodemon": "latest"
  },
  "scripts": {
    "start": "nodemon --watch './' index.js"
  }
}`,
    },
  },
  'socketserver.js': {
    file: {
      contents: `
      import net from 'net';

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
`,
    },
  },
  'io.js': {
    file: {
      contents: `
    process.stdin.on("data", data => {
      data = data.toString().toUpperCase();
      process.stdout.write(data);
    });

    setInterval(() => {
      process.stdout.write('' + Math.random());
    }, 1000);

`,
    },
  },
};
