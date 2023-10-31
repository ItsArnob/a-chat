export const logger = {
    ws: {
        info(msg) {
            console.log(`[WS] [INFO] [${new Date().toISOString()}] ${msg}`);
        },
        error(msg) {
            console.log(`[WS] [ERROR] [${new Date().toISOString()}] ${msg}`);
        },
    },
};
