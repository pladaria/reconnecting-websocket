const net = require('net');

const port = process.argv[2] || 50001;

const server = net.createServer(socket => {
    const time = Date.now();
    while (Date.now() - time < 2000) {
        // burn cpu
    }
    socket.destroy();
    server.close();
    console.log('bye');
});

server.listen(port, () => {
    console.log('listening', port);
});
