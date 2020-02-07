const net = require('net');

const port = process.argv[2] || 50001;
const sleepTime = process.argv[3] || 4000;

const server = net.createServer(socket => {
    socket.destroy();
    server.close();
});

server.listen(port, () => {
    console.log('listening:', port, 'sleep:', sleepTime);
    const time = Date.now();
    while (Date.now() - time < sleepTime) {
        // 🔥🔥🔥 burn cpu 🔥🔥🔥
    }
    server.close();
    console.log('bye');
});
