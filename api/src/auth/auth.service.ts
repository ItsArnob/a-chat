import { MONGODB_PROVIDER } from "@/constants";
import { MongoDB } from "@/database/database.interface";
import { ulid } from "ulid";
import { User, UserNoProfile } from "@/models/user.model";
import { UsersService } from "@/users/users.service";
import { Inject, Injectable, Logger, NotFoundException, UnauthorizedException } from "@nestjs/common";
import bcrypt from "bcrypt";
import { nanoid } from "nanoid/async";
import { ConfigService } from "@nestjs/config";
import { SessionDoc, sessionProjection } from "@/models/session.model";

@Injectable()
export class AuthService {
    private logger = new Logger(AuthService.name);

    constructor(
        private userService: UsersService,
        @Inject(MONGODB_PROVIDER)
        private mongo: MongoDB,
        private config: ConfigService
    ) {}

    async validateUser(
        username: string,
        password: string
    ): Promise<UserNoProfile> {
        const user = await this.userService.findOneNoProfileByName(username);
        if(!user) {
            this.logger.warn({
                event: `authn_login_fail:${username}`,
                msg: `Non-existent user account login attempted.`,
            });
            throw new UnauthorizedException("User not found.");
        };

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
            this.logger.warn({
                event: `authn_login_fail:${user.id}`,
                msg: "User attempted to log in using an incorrect password.",
            });
            throw new UnauthorizedException("Incorrect password.");
        };
        
        return user;
    }

    async validateToken(token: string, returnFullUser?: boolean) {
        const result = await this.findOneByToken(token, returnFullUser);
        if (result === 'session-not-found') {
            this.logger.warn({ event: 'session_invalid,session_not_found', msg: 'User attempted to access a protected route without being logged in.' });
            throw new UnauthorizedException("Invalid session token.");
        } else if (result === 'user-not-found') {
            this.logger.warn({ event: 'session_invalid,user_not_found', msg: 'User attempted to access a protected route without being logged in.' });
            throw new UnauthorizedException("Invalid session token.");
        } else {
            this.touchSession(result.sessionId);
            return result;
        }
    }

    async findOneByToken(token: string, returnFullUser?: boolean):Promise<User & { sessionName?: string | undefined, sessionId: string } | 'session-not-found' | 'user-not-found'>{
        const session = await this.mongo.sessions.findOne({ token: token }, { projection: sessionProjection });
        if (!session) return 'session-not-found';
        const user = returnFullUser ? await this.userService.findOneById(session.userId) : await this.userService.findOneNoProfileById(session.userId);;
        if (!user) return 'user-not-found';
        return { ...user, sessionName: session.name, sessionId: session._id };
    }

    async createSession(userId: string, name?: string): Promise<{id: string, token: string}> {
        const token = await nanoid(50);
        const id = ulid();
        const doc: SessionDoc = {
            _id: id,
            userId,
            expiresAt: new Date(Date.now() + this.config.get("sessionMaxAge") as number),
            token,
        }
        if(name) doc.name = name;
        await this.mongo.sessions.insertOne(doc);
        return { id, token };
    }

    touchSession(sessionId: string) {
        return this.mongo.sessions.updateOne({ _id: sessionId }, {
            $set: {
                expiresAt: new Date(Date.now() + this.config.get("sessionMaxAge") as number)
            }
        });
    }

    deleteSession(sessionId: string) {
        return this.mongo.sessions.deleteOne({ _id: sessionId });
    }
}
