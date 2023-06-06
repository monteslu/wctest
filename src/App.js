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
  const iframeEl = useRef(null);
  const terminalEl = useRef(null);
  const terminalE2 = useRef(null);
  useEffect(() => {
    console.log('useEffect');
    async function run() {
      console.log('run');
      if (!started) {
        started = true;
        
        async function installDependencies() {
          // Install dependencies
          const installProcess = await webcontainerInstance.spawn('npm', ['install']);
          installProcess.output.pipeTo(new WritableStream({
            write(data) {
              console.log(data);
            }
          }));
          // Wait for install command to exit
          return installProcess.exit;
        }

        async function startDevServer() {
          // Run `npm run start` to start the Express app
          const serverProcess = await webcontainerInstance.spawn('npm', ['run', 'start']);

          serverProcess.output.pipeTo(new WritableStream({
            write(data) {
              console.log(data);
            }
          }));
        
          // Wait for `server-ready` event
          webcontainerInstance.on('server-ready', (port, url) => {
            console.log(`Server is listening on port ${port} and is available at ${url}`);
            iframeEl.current.src = url;
          });
        }

        async function startShell(terminal) {
          const shellProcess = await webcontainerInstance.spawn('jsh');
          shellProcess.output.pipeTo(
            new WritableStream({
              write(data) {
                terminal.write(data);
              },
            })
          );
        
          const input = shellProcess.input.getWriter();
          terminal.onData((data) => {
            input.write(data);
          });
        
          return shellProcess;
        };

        // async function startIo(terminal) {
        //   const shellProcess = await webcontainerInstance.spawn('node', ['io.js']);
        //   shellProcess.output.pipeTo(
        //     new WritableStream({
        //       write(data) {
        //         terminal.write(data);
        //       },
        //     })
        //   );
        
        //   const input = shellProcess.input.getWriter();
        //   terminal.onData((data) => {
        //     input.write(data);
        //   });
        
        //   return shellProcess;
        // };

        webcontainerInstance = await WebContainer.boot();

        await webcontainerInstance.mount(files);
        console.log(webcontainerInstance);
        const packageJSON = await webcontainerInstance.fs.readFile('package.json', 'utf-8');
        console.log(packageJSON);
        const exitCode = await installDependencies();
        if (exitCode !== 0) {
          throw new Error('Installation failed');
        };

        webcontainerInstance.on('port', (port, b, c, d) => {
          console.log(`something is listening on port ${port} and is available at ${b} ${c} ${d}`);
        });

        const terminal = new Terminal({
          convertEol: true,
        });
        terminal.open(terminalEl.current);
        await startShell(terminal);

        // const terminal2 = new Terminal({
        //   convertEol: true,
        // });
        // terminal2.open(terminalE2.current);
        // await startIo(terminal2);
        

        await startDevServer();
        const net = await createNet(webcontainerInstance);
        console.log('net', net);
        const con = await hsync.dynamicConnect(null, true, { net });
        console.log('hsync con', con);
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
      <div className="terminal" ref={terminalEl}></div>
      <div className="terminal" ref={terminalE2}></div>
    </div>
  );
}

export default App;
