import {
    Injectable,
    ExecutionContext,
    CanActivate,
    UnauthorizedException,
    Logger,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class AuthenticatedGuard extends AuthGuard("bearer") {}
