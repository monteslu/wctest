import React, { useEffect, useState, useRef } from 'react';
import { Terminal } from 'xterm'
import hsync from 'hsync/hsync-web';
import 'xterm/css/xterm.css';
import { WebContainer } from '@webcontainer/api';

import './App.css';
import { files } from './files';
import createNet from './webcont-net';

let webcontainerInstance;
let started = false;

async function writeIndexJS(content) {
  await webcontainerInstance.fs.writeFile('/index.js', content);
};

function App() {
  const [taContent, setTaContent] = useState(files['index.js'].file.contents);
  const [hsycnUrl, setHsyncUrl] = useState(null);
  const iframeEl = useRef(null);
  const terminalEl = useRef(null);
  const terminalEl2 = useRef(null);
  useEffect(() => {
    console.log('useEffect');
    let con;
    async function run() {
      console.log('run');
      if (!started) {
        started = true;

        const terminal = new Terminal({
          convertEol: true,
        });
        terminal.open(terminalEl.current);
        const terminal2 = new Terminal({
          convertEol: true,
        });
        terminal2.open(terminalEl2.current);

        const t1Stream = new WritableStream({
          write(data) {
            terminal.write(data);
          },
        });

        const installStream = new WritableStream({
          write(data) {
            terminal2.write(data);
          },
        });
        const serverStream = new WritableStream({
          write(data) {
            terminal2.write(data);
          },
        });

        async function installDependencies() {
          // Install dependencies
          const installProcess = await webcontainerInstance.spawn('npm', ['install']);
          installProcess.output.pipeTo(installStream);
          // Wait for install command to exit
          return installProcess.exit;
        }

        async function startDevServer() {
          // Run `npm run start` to start the Express app
          const serverProcess = await webcontainerInstance.spawn('npm', ['run', 'start']);

          serverProcess.output.pipeTo(serverStream);
        
          // Wait for `server-ready` event
          webcontainerInstance.on('server-ready', (port, url) => {
            console.log(`Server is listening on port ${port} and is available at ${url}`);
            iframeEl.current.src = url;
            setHsyncUrl(con.webUrl);
          });

          return serverProcess;
        }

        async function startShell() {
          const shellProcess = await webcontainerInstance.spawn('jsh');
          shellProcess.output.pipeTo(t1Stream);
        
          const input = shellProcess.input.getWriter();
          terminal.onData((data) => {
            input.write(data);
          });
        
          return shellProcess;
        };

        webcontainerInstance = await WebContainer.boot();

        await webcontainerInstance.mount(files);
        console.log(webcontainerInstance);
        // const packageJSON = await webcontainerInstance.fs.readFile('package.json', 'utf-8');
        // console.log(packageJSON);
        const exitCode = await installDependencies();
        if (exitCode !== 0) {
          throw new Error('Installation failed');
        };
        await startShell();
        await startDevServer();

        const net = await createNet(webcontainerInstance);

        console.log('net', net);
        con = await hsync.dynamicConnect(null, true, { net });
        console.log('hsync con', con);
        console.log('connect on', con.webUrl);
      }
    }
    run();
  }, []);

  return (
    <div>
      <div className="container">
        <div className="editor">
          <textarea
            value={taContent}
            onChange={(e) => {
              setTaContent(e.target.value);
              writeIndexJS(e.target.value);
            }}
          />
        </div>
        <div className="preview">
          <iframe
            title="preview"
            ref={iframeEl}
          />
        </div>
      </div>
      <div style={ { margin: '5px' }}>
        {hsycnUrl ? (
          <a href={hsycnUrl} target="_blank" rel="noopener noreferrer">
            Open here: {hsycnUrl}
          </a>
        ) : ''}
      </div>
      <div className="terminal-container">
        <div>jsh shell:</div>
        <div className="terminal" ref={terminalEl}></div>
      </div>
      <div className="terminal-container">
        <div>install; run server:</div>
        <div className="terminal" ref={terminalEl2}></div>
      </div>
    </div>
  );
}

export default App;
