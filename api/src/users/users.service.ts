import bcrypt from 'bcrypt';
import { DATABASE_PROVIDER } from '@/constants';
import { MongoDB } from '@/database/database.interface';
import { OnlineSocketsList } from '@/dto/chat.dto';
import { AddFriendDto, RemoveFriendDto } from '@/dto/user.dto';
import { Chat, chatProjection, ChatType } from '@/models/chat.model';
import {
    Relation,
    RelationStatus,
    User,
    UserDoc,
    UserNoProfile,
    UserNoProfileDoc,
    userNoProfileProjection,
    userProjection,
    UserRelation,
    userRelationsProjection
} from '@/models/user.model';
import {
    ConflictException, ImATeapotException,
    Inject,
    Injectable,
    InternalServerErrorException,
    NotFoundException,
    UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UpdateFilter } from 'mongodb';
import { ulid } from 'ulid';

@Injectable()
export class UsersService {
    constructor(
        private jwtService: JwtService,
        @Inject(DATABASE_PROVIDER)
        private mongo: MongoDB,
        private configService: ConfigService
    ) {}
    async findOneByName(username: string): Promise<User> {
        const result = await this.mongo.users.findOne({ username }, {
            projection: userProjection,
            collation: { locale: 'en', strength: 2 }
        });
        if(!result) throw new NotFoundException('User not found.');
        const { _id: id, ...user } = result;
        return {
            id,
            ...user
        };
    }
    async findOneNoProfileByName(username: string): Promise<UserNoProfile> {
        const result = await this.mongo.users.findOne<UserNoProfileDoc>({ username }, {
            projection: userNoProfileProjection,
            collation: { locale: 'en', strength: 2 }
        });
        if (!result) throw new NotFoundException('User not found.');

        const { _id: id, ...user } = result;
        return {
            id,
            ...user
        }
    }

    async findOneById(userId: string): Promise<User> {
        const result = await this.mongo.users.findOne({
            _id: userId
        }, { projection: userProjection })
        if (!result) throw new NotFoundException('Account not found.');
        const { _id: id, ...user } = result;
        return { id, ...user };
    }

    async findOneNoProfileById(userId: string): Promise<UserNoProfile> {
        const result = await this.mongo.users.findOne<UserNoProfileDoc>({ _id: userId }, { projection: userNoProfileProjection });
        if (!result) throw new NotFoundException('Account not found.');
        const { _id: id, ...user } = result;
        return  { id, ...user };
    }

    async findOneByToken(token: string): Promise<User> {
        const userToken = await this.jwtService
        .verifyAsync(token)
        .catch((e) => {});
        if (!userToken)
            throw new UnauthorizedException('Invalid authentication token.');

        const result = await this.mongo.users.findOne({
            token: userToken.jti as string
        }, {
            projection: userProjection
        });
        if (!result) throw new NotFoundException('Invalid authentication token.');
        const { _id: id, ...user } = result;
        return {
            id,
            ...user
        }
    }

    async findRelationsOfUser(id: string): Promise<UserRelation[]> {
        const userRelations = await this.mongo.users.findOne<{ profile: { relations: UserRelation[] } }>({ _id: id }, {
            projection: userRelationsProjection,
        });
        return userRelations?.profile?.relations ? userRelations.profile.relations : [];
    }

    async findRelatedUsersWithStatus(userIds: string[], sockets: OnlineSocketsList, relations: Relation[]) {
        const users = await this.mongo.users.find<{ _id: string, username: string }>({
            _id: {
                $in: userIds
            }
        }, { projection: { _id: 1, username: 1 } }).toArray();

        return users.map(({ _id: id, username }) => {
            const relationship = relations.find(relation => relation.id === id)?.status;
            const online = sockets.get(id)?.online;
            return {
                id,
                online: relationship === RelationStatus.Friend ? online : false, // return online status only if users are friends else false.
                username,
                relationship
            }
        });
    };

    async getFriendIds(userId: string): Promise<string[]> {
        const user = await this.mongo.users.findOne({ _id: userId }, { projection: {  profile: { relations: 1 } }});
        return user?.profile?.relations?.map(user => user.id) || [];
    }

    async setToken(userId: string, tokenId: string | null): Promise<void> {
        const updateData: Partial<UserDoc> | UpdateFilter<UserDoc> = tokenId ? {  $set: { token: tokenId } } : {
            $unset: {
                token: ""
            }
        }
        await this.mongo.users.updateOne({
            _id: userId
        }, updateData)
        return;
    }

     async addFriend(
        receiverUsernameOrId: string,
        sender: UserNoProfile,
        isId: boolean
    ): Promise<AddFriendDto> {

        const receiverUser = isId
            ? await this.findOneById(receiverUsernameOrId)
            : await this.findOneByName(receiverUsernameOrId);

        if (receiverUser.id === sender.id)
            throw new ConflictException("You can't add yourself as a friend.");
        const relationship = receiverUser.profile?.relations?.find(
            (relation) => relation.id === sender.id
        );
        if (relationship) {
            switch (relationship.status) {
                case RelationStatus.Friend:
                    throw new ConflictException(
                        'You are already friends with this user.'
                    );
                case RelationStatus.Incoming:
                    throw new ConflictException(
                        'You already sent a friend request to this user.'
                    );
                case RelationStatus.Blocked:
                    throw new ConflictException('You blocked this user.');
                case RelationStatus.BlockedByOther:
                    throw new ConflictException('This user blocked you.');
                case RelationStatus.Outgoing: // accepts the friend request

                    const session = this.mongo.client.startSession()
                    let chat: Chat;
                    try {
                        await session.withTransaction(async () => {
                            await this.mongo.users.updateOne({
                                _id: receiverUser.id,
                                'profile.relations.id': sender.id
                            }, {
                                $set: {
                                    "profile.relations.$.status": RelationStatus.Friend
                                }
                            }, { session });
                            await this.mongo.users.updateOne({
                                _id: sender.id,
                                'profile.relations.id': receiverUser.id
                            }, {
                                $set: {
                                    'profile.relations.$.status': RelationStatus.Friend
                                }
                            }, { session });

                            const result = await this.mongo.chats.findOne({
                                chatType: ChatType.Direct,
                                'recipients.id': {
                                    $all: [receiverUser.id, sender.id]
                                }
                            }, { projection: chatProjection, session });
                            if(result) {
                                const { _id: id, ...chatData } = result;
                                chat = { id, ...chatData };
                                return;
                            }
                            const newChat = {
                                _id: ulid(),
                                chatType: ChatType.Direct,
                                recipients: [
                                    {
                                        id: sender.id
                                    },
                                    {
                                        id: receiverUser.id
                                    }
                                ]
                            }
                            await this.mongo.chats.insertOne(newChat, { session })

                            const { _id, ...rest } = newChat;
                            chat = {
                                id: _id,
                                ...rest
                            };
                            return;
                        });
                    } finally {
                        await session.endSession()
                    }

                    return {
                        user: {
                            id: receiverUser.id,
                            username: receiverUser.username,
                        },
                        // @ts-ignore it IS assigned in the try block.
                        chat,
                        message: 'Friend request accepted.',
                    };
            }
        }

        const session = this.mongo.client.startSession();

        await session.withTransaction(async() => {
            await this.mongo.users.updateOne({
                _id: receiverUser.id,
            }, {
                $push: {
                    'profile.relations': {
                        id: sender.id,
                        status: RelationStatus.Incoming
                    }
                }

            });
            await this.mongo.users.updateOne({
                _id: sender.id
            }, {
                $push: {
                    'profile.relations': {
                        id: receiverUser.id,
                        status: RelationStatus.Outgoing
                    }
                }
            })

        })
        return {
            user: {
                id: receiverUser.id,
                username: receiverUser.username,
            },
            message: 'Friend request sent.',
        };
    }
     async removeFriend(userId: string, user: UserNoProfile): Promise<RemoveFriendDto> {
        const userProfile = await this.findOneById(user.id);
        const relationship = userProfile.profile?.relations?.find(
            (relation) => relation.id === userId
        );
        if (!relationship) throw new NotFoundException('User not found.');

        let message: string;

        const removeFriendTransaction = async () => {
            const session = this.mongo.client.startSession();
            await session.withTransaction(async() => {
                await this.mongo.users.updateOne({
                    _id: userProfile.id,
                }, {
                    $pull: {
                        'profile.relations': {
                            id: userId
                        }
                    }
                }, { session });
                await this.mongo.users.updateOne({
                    _id: userId,
                }, {
                    $pull: {
                        'profile.relations': {
                            id: userProfile.id
                        }
                    }
                }, { session })
            });
            return {
                user: {
                    id: userId,
                },
                message,
            };
        };
        switch (relationship.status) {
            case RelationStatus.BlockedByOther:
                throw new ConflictException('This user blocked you.');
            case RelationStatus.Blocked:
                throw new ConflictException('You blocked this user.');
            case RelationStatus.Friend:
                message = 'Friend removed.';
                return await removeFriendTransaction();
            case RelationStatus.Outgoing:
                message = 'Friend request canceled.';
                return await removeFriendTransaction();
            case RelationStatus.Incoming:
                message = 'Friend request declined.';
                return await removeFriendTransaction();
            default:
                throw new InternalServerErrorException();
        }
    };

    async createUser(username: string, password: string): Promise<void> {
        if(this.configService.get("disableSignup")) {
            throw new ImATeapotException("User registration is currently turned off.");
        }
        const userExists = await this.mongo.users.findOne<{ _id: string }>({ username }, { projection: { _id: 1 }, collation: { locale: 'en', strength: 2 }});
        if(userExists) throw new ConflictException("Username is taken.");
        const passwordHash = await bcrypt.hash(password, this.configService.get("bcryptRounds") as number);

        const id = ulid();
        await this.mongo.users.insertOne({
            _id: id,
            username,
            passwordHash
        });
        return;
    }
}
