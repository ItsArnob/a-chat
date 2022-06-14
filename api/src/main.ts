import { CustomIoAdapter } from '@/adapters/socketio';
import { AppModule } from '@/app.module';
import { LoggingInterceptor } from '@/common/interceptors/null-remover.interceptor';
import { ValidationPipe } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import passport from 'passport';

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);
    const config = app.get<ConfigService>(ConfigService);
    const customIoAdapter = new CustomIoAdapter(app);
    app.enableCors({
        origin: config.get('corsOrigins') as string[],
        credentials: true,
    });
    if (config.get('trustProxy')) {
        app.set('trust proxy', 1);
    }
    app.useGlobalPipes(
        new ValidationPipe({ transform: true, whitelist: true })
    );
    app.use(passport.initialize());
    app.useWebSocketAdapter(customIoAdapter);
    app.useGlobalInterceptors(new LoggingInterceptor());
    await app.listen(config.get('port') as number);
}
bootstrap();
