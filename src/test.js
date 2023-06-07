const net = require('net');

console.log('firing up tcprelay');

const basicGet = `GET /hello.htm HTTP/1.1
User-Agent: Mozilla/4.0 (compatible; MSIE5.01; Windows NT)
Host: www.tutorialspoint.com
Accept-Language: en-us
Accept-Encoding: gzip, deflate
Connection: Keep-Alive

`;

setTimeout(() => {
  const sock1 = new net.Socket();
  sock1.connect(3110, 'localhost', () => {
    console.log('connected to 3000');
    sock1.write(basicGet);
  });
  sock1.on('data', (data) => {
    console.log('data from 3000', data.toString());
  });
}, 2000);