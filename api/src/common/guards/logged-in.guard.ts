import { Injectable, ExecutionContext, CanActivate, UnauthorizedException, Logger } from "@nestjs/common";

@Injectable()
export class LoggedInGuard implements CanActivate {
    private logger = new Logger(LoggedInGuard.name);
    canActivate(context: ExecutionContext): boolean {
        if(context.switchToHttp().getRequest().isAuthenticated()) return true;
        this.logger.warn({ event: 'session_invalid', msg: 'User attempted to access a protected route without being logged in.' });
        throw new UnauthorizedException("Invalid session.");
    }
}