'use strict';

// Sent to client (extension)
process.on('message', message => {
    process.send({
        type: 'ok',
        originalMessage: message
    });
})