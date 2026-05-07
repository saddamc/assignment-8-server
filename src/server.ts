import { Server } from 'http';
import app from './app';
import config from './config';


async function bootstrap() {
    let server: Server;

    try {
        server = app.listen(config.port, () => {
            console.log(`🚀 E-Commerce Server is running on http://localhost:${config.port}`);
        });

        const exitHandler = () => {
            if (server) {
                server.close(() => {
                    console.log('Server closed gracefully.');
                    process.exit(1);
                });
            } else {
                process.exit(1);
            }
        };

        process.on('unhandledRejection', (error) => {
            console.log('Unhandled Rejection is detected, we are closing our server...');
            if (server) {
                server.close(() => {
                    console.log(error);
                    process.exit(1);
                });
            } else {
                process.exit(1);
            }
        });
    } catch (error) {
        console.error('Error during server startup:', error);
        process.exit(1);
    }
}

bootstrap();
