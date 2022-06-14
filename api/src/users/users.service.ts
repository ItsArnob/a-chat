import {
    AccountUserDto,
    RelatedUsersDto,
    RelationshipStatusWithNone,
    UserDto,
} from '@/dto/user.dto';
import { PrismaService } from '@/prisma/prisma.service';
import {
    BadRequestException,
    ConflictException,
    Injectable,
    InternalServerErrorException,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
    Account,
    ChatType,
    Relation,
    RelationStatus,
    User,
} from '@prisma/client';
import { ObjectId } from 'mongodb';

@Injectable()
export class UsersService {
    constructor(
        private jwtService: JwtService,
        private prisma: PrismaService
    ) {}
    async findOneByName(username: string): Promise<Account> {
        const user = await this.prisma.account.findFirst({
            where: { username: { mode: 'insensitive', equals: username } },
        });
        if (!user) throw new NotFoundException('Account not found.');
        return user;
    }

    async findProfileByName(username: string): Promise<AccountUserDto> {
        const user = await this.prisma.account.findFirst({
            where: { username: { mode: 'insensitive', equals: username } },
            include: { user: true },
        });
        if (!user) throw new NotFoundException('Account not found.');
        if (!user.user)
            throw new InternalServerErrorException(
                'Unknown things occurred, please try again later.'
            );
        return { ...user, user: user.user as User };
    }

    async setToken(id: string, tokenId: string | null): Promise<UserDto> {
        return this.prisma.account.update({
            where: {
                id,
            },
            data: {
                tokenId: tokenId || {
                    unset: true,
                },
            },
            select: {
                id: true,
                username: true,
                isOwner: true,
            },
        });
    }

    async findOneByToken(token: string): Promise<Account> {
        const userToken = await this.jwtService
            .verifyAsync(token)
            .catch((e) => {});
        if (!userToken)
            throw new UnauthorizedException('Invalid authentication token.');

        const user = await this.prisma.account.findFirst({
            where: {
                tokenId: userToken.jti as string,
            },
        });
        if (!user) throw new NotFoundException('Invalid authentication token.');
        return user;
    }

    async findOneById(id: string): Promise<Account> {
        const user = await this.prisma.account.findUnique({ where: { id } });
        if (!user) throw new NotFoundException('Account not found.');
        return user;
    }

    async findProfileById(userId: string): Promise<AccountUserDto> {
        const user = await this.prisma.account.findUnique({
            where: {
                id: userId,
            },
            include: {
                user: true,
            },
        });
        if (!user) throw new NotFoundException('Account not found.');
        if (!user.user)
            throw new InternalServerErrorException(
                'Unknown things occurred, please try again later.'
            );
        return { ...user, user: user.user as User };
    }

    async getRelationsOfUserId(userId: string) {
        return this.prisma.user.findUnique({
            where: {
                id: userId,
            },
            select: {
                relations: true,
            },
        });
    }
    async findUsernamesById(ids: string[]) {
        return this.prisma.account.findMany({
            where: {
                id: {
                    in: ids,
                },
            },
            select: {
                id: true,
                username: true,
            },
        });
    }

    async addFriend(
        receiverUsernameOrId: string,
        sender: Account,
        isId: boolean
    ) {
        if (isId && !ObjectId.isValid(receiverUsernameOrId))
            throw new BadRequestException('Invalid user ID.');
        const receiverAccount = isId
            ? await this.findProfileById(receiverUsernameOrId)
            : await this.findProfileByName(receiverUsernameOrId);

        if (receiverAccount.id === sender.id)
            throw new ConflictException("You can't add yourself as a friend.");
        const relationship = receiverAccount.user.relations.find(
            (relation) => relation.userId === sender.id
        );
        // TODO: Check if these two users have a existing inbox, create one in the transaction if they dont.
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
                case RelationStatus.BlockedBySelf:
                    throw new ConflictException('You blocked this user.');
                case RelationStatus.BlockedByOther:
                    throw new ConflictException('This user blocked you.');
                case RelationStatus.Outgoing: // accepts the friend request
                    // TODO: FIX: This can cause write conflict.

                    const chat = await this.prisma.$transaction(
                        async (prisma) => {
                            await prisma.user.update({
                                where: {
                                    id: receiverAccount.id,
                                },
                                data: {
                                    relations: {
                                        updateMany: {
                                            where: {
                                                userId: sender.id,
                                            },
                                            data: {
                                                status: RelationStatus.Friend,
                                            },
                                        },
                                    },
                                },
                            });
                            await prisma.user.update({
                                where: {
                                    id: sender.id,
                                },
                                data: {
                                    relations: {
                                        updateMany: {
                                            where: {
                                                userId: receiverAccount.id,
                                            },
                                            data: {
                                                status: RelationStatus.Friend,
                                            },
                                        },
                                    },
                                },
                            });
                            const existingChat = await prisma.chat.findFirst({
                                where: {
                                    chatType: ChatType.Direct,
                                    recipients: {
                                        every: {
                                            userId: {
                                                in: [
                                                    sender.id,
                                                    receiverAccount.id,
                                                ],
                                            },
                                        },
                                    },
                                },
                            });
                            if (existingChat) {
                                return existingChat;
                            }
                            return prisma.chat.create({
                                data: {
                                    chatType: ChatType.Direct,
                                    recipients: [
                                        {
                                            userId: sender.id,
                                        },
                                        {
                                            userId: receiverAccount.id,
                                        },
                                    ],
                                },
                            });
                        }
                    );
                    return {
                        user: {
                            id: receiverAccount.id,
                            username: receiverAccount.username,
                        },
                        chat,
                        message: 'Friend request accepted.',
                    };
            }
        }
        // TODO: FIX: This can cause write conflict.
        await this.prisma.$transaction([
            this.prisma.user.update({
                where: {
                    id: receiverAccount.id,
                },
                data: {
                    relations: {
                        push: [
                            {
                                userId: sender.id,
                                status: RelationStatus.Incoming,
                            },
                        ],
                    },
                },
            }),
            this.prisma.user.update({
                where: {
                    id: sender.id,
                },
                data: {
                    relations: {
                        push: [
                            {
                                userId: receiverAccount.id,
                                status: RelationStatus.Outgoing,
                            },
                        ],
                    },
                },
            }),
        ]);
        return {
            user: {
                id: receiverAccount.id,
                username: receiverAccount.username,
            },
            message: 'Friend request sent.',
        };
    }
    async removeFriend(userId: string, user: Account) {
        if (!ObjectId.isValid(userId))
            throw new BadRequestException('Invalid user ID.');
        const userAccount = await this.findProfileById(user.id);
        const relationship = userAccount.user.relations.find(
            (relation) => relation.userId === userId
        );
        if (!relationship) throw new NotFoundException('User not found.');

        let message: string;
        // TODO: FIX: This can cause write conflict.
        const removeFriendTransaction = async () => {
            await this.prisma.$transaction([
                this.prisma.user.update({
                    where: {
                        id: userAccount.id,
                    },
                    data: {
                        relations: {
                            deleteMany: {
                                where: {
                                    userId: userId,
                                },
                            },
                        },
                    },
                }),
                this.prisma.user.update({
                    where: {
                        id: userId,
                    },
                    data: {
                        relations: {
                            deleteMany: {
                                where: {
                                    userId: userAccount.id,
                                },
                            },
                        },
                    },
                }),
            ]);
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
            case RelationStatus.BlockedBySelf:
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
    }
    async getRelatedUsers(
        userId: string,
        returnAccount?: boolean,
        onlineUsersIds?: string[],
        usersOfChats?: string[]
    ): Promise<RelatedUsersDto> {
        let relations: Relation[] = [];
        let account: AccountUserDto | null = null; // thanks typescript.

        if (returnAccount) {
            account = await this.findProfileById(userId);
            relations = account.user.relations;
        } else {
            const relationsOfThisUser = await this.getRelationsOfUserId(userId);
            if (!relationsOfThisUser)
                throw new NotFoundException('Account not found.');
            relations = relationsOfThisUser.relations;
        }
        const usersThatAreNotRelatedButAreInTheInbox = usersOfChats?.filter(
            (userId) =>
                !relations.some((relation) => relation.userId === userId)
        );
        const users =
            usersThatAreNotRelatedButAreInTheInbox?.length || relations.length
                ? await this.prisma.account.findMany({
                      where: {
                          id: {
                              in: [
                                  ...relations.map(
                                      (relation) => relation.userId
                                  ),
                                  ...(usersThatAreNotRelatedButAreInTheInbox ||
                                      []),
                              ],
                          },
                      },
                      select: {
                          id: true,
                          username: true,
                      },
                  })
                : null;
        const relatedUsers = users?.map((relatedUser) => {
            const relation = relations.find(
                (relation) => relation.userId === relatedUser.id
            ) as Relation;
            return {
                ...relatedUser,
                relationship: usersThatAreNotRelatedButAreInTheInbox?.includes(
                    relatedUser.id
                )
                    ? RelationshipStatusWithNone.None
                    : relation.status,
                online: onlineUsersIds
                    ? !!onlineUsersIds.find(
                          (userId) =>
                              userId === relatedUser.id &&
                              relations.find(
                                  (relation) =>
                                      relation.status === RelationStatus.Friend
                              )
                      )
                    : false,
            };
        });
        return {
            account: returnAccount ? account : null,
            users: relatedUsers ? relatedUsers : [],
        };
    }
}
