import { Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Account } from "@prisma/client";
import { Strategy } from "passport-local";
import { AuthService } from "./auth.service";

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
    constructor(private authService: AuthService) {
        super()
    }
    async validate(username: string, password: string): Promise<Account> {
        try {
            return await this.authService.validateUser(username, password);
        } catch(e) {
            if(e instanceof UnauthorizedException || e instanceof NotFoundException) {
                throw new UnauthorizedException("Invalid username or password.");
            } else throw new InternalServerErrorException();
        }

    }
}

