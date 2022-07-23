import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    Logger,
} from "@nestjs/common";
import { WsException } from "@nestjs/websockets";

@Catch()
export class WsExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(WsExceptionFilter.name);

    catch(exception: any, host: ArgumentsHost) {
        const ctx = host.switchToWs();
        const ws = ctx.getClient();

        if (exception instanceof HttpException) {
            ws.emit("exception", {
                type: exception.getStatus(),
                message: exception.getResponse(),
            });
        } else if (exception instanceof WsException) {
            if (exception.getError() instanceof Object) {
                const { type, ...error } = exception.getError() as any;

                ws.emit("exception", { type, message: error });
            } else
                ws.emit("exception", {
                    type: "unknown",
                    message: exception.getError(),
                });
        } else {
            ws.emit("exception", {
                type: "unknown",
                message: "Internal Server Error",
            });
            this.logger.error(exception);
        }
    }
}
