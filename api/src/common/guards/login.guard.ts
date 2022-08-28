import { LoginDto } from "@/dto/auth.dto";
import {
    BadRequestException,
    ExecutionContext,
    HttpStatus,
    Injectable,
    Logger,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";

@Injectable()
export class LoginGuard extends AuthGuard("local") {

    constructor(
        @InjectPinoLogger(LoginGuard.name)
        private logger: PinoLogger
    ) { super() }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const credentials = plainToInstance(LoginDto, request.body);

        const validationErrors = await validate(credentials, {
            validationError: { target: false, value: false },
        });

        if (validationErrors.length > 0) {
            const errors: any = {};
            validationErrors.forEach((err) => {
                errors[err.property] = Object.values(err.constraints as any);
            });
            this.logger.warn({
                event: `input_validation_fail,${Object.keys(errors)}`,
                msg: "User submitted data that failed validation.",
            });
            throw new BadRequestException({
                statusCode: HttpStatus.BAD_REQUEST,
                message: {
                    validationError: errors,
                },
            });
        }
        const result = (await super.canActivate(context)) as boolean;
        if (credentials.friendlyName)
            request.user.sessionName = credentials.friendlyName;
        return result;
    }
}
