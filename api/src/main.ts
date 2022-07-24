import { CustomIoAdapter } from "@/adapters/socketio";
import { AppModule } from "@/app.module";
import {
    BadRequestException,
    HttpStatus,
    ValidationPipe,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { Logger } from "nestjs-pino";

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
        bufferLogs: true,
    });

    const config = app.get<ConfigService>(ConfigService);
    const logger = app.get(Logger);

    const customIoAdapter = new CustomIoAdapter(app);

    app.enableCors({
        origin: config.get("corsOrigins") as string[],
        credentials: true,
    });

    if (config.get("trustProxy")) {
        app.set("trust proxy", 1);
    }

    app.useGlobalPipes(
        new ValidationPipe({
            transform: true,
            whitelist: true,
            exceptionFactory: (validationErrors) => {
                const errors: any = {};
                validationErrors.forEach((err) => {
                    errors[err.property] = Object.values(
                        err.constraints as any
                    );
                });
                logger.warn({
                    event: `input_validation_fail,${Object.keys(errors)}`,
                    msg: "User submitted data that failed validation.",
                });
                return new BadRequestException({
                    statusCode: HttpStatus.BAD_REQUEST,
                    message: {
                        validationError: errors,
                    },
                });
            },
        })
    );

    app.useLogger(logger);
    app.useWebSocketAdapter(customIoAdapter);
    await app.listen(config.get("port") as number);
}
bootstrap();
