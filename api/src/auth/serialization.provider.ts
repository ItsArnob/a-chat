import { UserNoProfile } from "@/models/user.model";
import { UsersService } from "@/users/users.service";
import { Injectable, NotFoundException } from "@nestjs/common";
import { PassportSerializer } from "@nestjs/passport";

@Injectable()
export class AuthSerializer extends PassportSerializer {
    constructor(private usersService: UsersService) { super() }

    serializeUser(user: UserNoProfile, done: (err: Error | null, user: { id: string }) => void) {
        done(null, { id: user.id });
    }

    deserializeUser(payload: { id: string }, done: (err: Error | null, user: UserNoProfile | null) => void) {
        this.usersService.findOneNoProfileById(payload.id).then(user => {
            done(null, user);
        }).catch(e => {
            done(e, null)
        })
    }
}