import { LoginDto } from '@/dto/auth.dto';
import {
    BadRequestException,
    ExecutionContext,
    Injectable,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

@Injectable()
export class LoginGuard extends AuthGuard('local') {
    async canActivate(context: ExecutionContext) {
        const request = context.switchToHttp().getRequest();
        const credentials = plainToInstance(LoginDto, request.body);
        const errors = await validate(credentials, {
            validationError: { target: false, value: false },
        });
        if (errors.length > 0) {
            let errs: string[] = [];
            errors.forEach((error) => {
                errs = [
                    ...Object.values(
                        error.constraints as { [type: string]: string }
                    ),
                    ...errs,
                ];
            });
            throw new BadRequestException(errs);
        }
        const result = (await super.canActivate(context)) as boolean;
        return result;
    }
}
