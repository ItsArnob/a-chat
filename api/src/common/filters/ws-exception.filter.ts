import { Catch, HttpException, ArgumentsHost } from "@nestjs/common";
import { BaseWsExceptionFilter, WsException } from "@nestjs/websockets";

@Catch(HttpException)
export class HttpExceptionWsFilter extends BaseWsExceptionFilter {
    catch(exception: HttpException, host: ArgumentsHost) {
        const properError = new WsException(exception.getResponse());
        super.catch(properError, host);
    }
}