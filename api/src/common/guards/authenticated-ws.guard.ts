import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';


@Injectable()
export class AuthenticatedWsGuard implements CanActivate {
    canActivate(
        context: ExecutionContext,
    ): boolean {
        const client = context.switchToWs().getClient()
        return !!client.user.id
    }
}
