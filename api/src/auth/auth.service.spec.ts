import { UsersService } from "../users/users.service";
import { Test } from "@nestjs/testing";
import { AuthService } from "./auth.service";
import { MONGODB_PROVIDER } from "@/constants";
import { ModuleMocker, MockFunctionMetadata } from "jest-mock";
import { UnauthorizedException } from "@nestjs/common";
import { Session, SessionDoc, sessionProjection } from "@/models/session.model";
import { RelationStatus, User, UserNoProfile } from "@/models/user.model";
import { Document, Filter, FindOptions } from "mongodb";
import { MongoDB } from "@/database/database.interface";

import nanoid from "nanoid/async";
import * as ulid from "ulid";
import { ConfigService } from "@nestjs/config";

const moduleMocker = new ModuleMocker(global);

describe("AuthService", () => {
    let authService: AuthService;
    let usersService: UsersService;
    let config: ConfigService;
    let mongo: Pick<MongoDB, "sessions">;

    // pretend that this is the only user that exists in our "database".
    const user: UserNoProfile = {
        id: "1",
        passwordHash:
            "$2b$10$Wz9VGNz0oJPtAv7akD3HYeVjscV49dPWVOADO8DiDN48iSvE60VjG",
        username: "test",
    };
    const userWithProfile: User = {
        ...user,
        profile: { relations: [{ id: "2", status: RelationStatus.Friend }] },
    };
    const currentTime = 123456789;
    const idleTimeout = 2;

    let session: Omit<Session, "id"> & { _id: string } = {
        _id: "1",
        expiresAt: new Date(),
        token: "validToken",
        userId: "1",
        name: "Chrome on Linux",
    };
    let sessionOfNonExistentUser: Omit<Session, "id"> & { _id: string } = {
        _id: "2",
        expiresAt: new Date(),
        token: "validTokenButNoUser",
        userId: "3",
        name: "Chrome on Linux",
    };

    beforeEach(async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [AuthService],
        })
            .useMocker((token) => {
                if (token === MONGODB_PROVIDER) {
                    return {
                        sessions: {
                            findOne: jest.fn(
                                async (
                                    query: Filter<SessionDoc>,
                                    opts: FindOptions<Document>
                                ) => {
                                    if (query?.token === session.token)
                                        return Promise.resolve(session);
                                    if (
                                        query?.token ===
                                        sessionOfNonExistentUser.token
                                    )
                                        return Promise.resolve(
                                            sessionOfNonExistentUser
                                        );
                                    return null;
                                }
                            ),
                            insertOne: jest.fn(),
                            updateOne: jest.fn(),
                            deleteOne: jest.fn(),
                        },
                    };
                }
                if (token === UsersService) {
                    return {
                        findOneNoProfileByName: jest.fn(
                            async (username: string) =>
                                Promise.resolve(
                                    username === user.username ? user : null
                                )
                        ),
                        findOneById: jest.fn(async (userid: string) =>
                            Promise.resolve(
                                userid === userWithProfile.id
                                    ? userWithProfile
                                    : null
                            )
                        ),
                        findOneNoProfileById: jest.fn(async (userid: string) =>
                            Promise.resolve(userid === user.id ? user : null)
                        ),
                    };
                }
                if (token === ConfigService) {
                    return {
                        get: jest.fn((key: string) => {
                            if (key === "sessionMaxAge") return idleTimeout;
                            return;
                        }),
                    };
                }
                if (typeof token === "function") {
                    const mockMetadata = moduleMocker.getMetadata(
                        token
                    ) as MockFunctionMetadata<any, any>;
                    const Mock =
                        moduleMocker.generateFromMetadata(mockMetadata);
                    return new Mock();
                }
            })
            .compile();

        authService = moduleRef.get<AuthService>(AuthService);
        mongo = moduleRef.get<MongoDB>(MONGODB_PROVIDER);
        usersService = moduleRef.get<UsersService>(UsersService);
        config = moduleRef.get<ConfigService>(ConfigService);
    });

    describe("validateUser", () => {
        it("should successfully validate user with correct credential", async () => {
            await expect(
                authService.validateUser("test", "qweasdzxc")
            ).resolves.toBe(user);
        });

        it("should throw user not found with invalid username", async () => {
            const res = async () =>
                await authService.validateUser("test1", "qweasdzxc");
            await expect(res).rejects.toThrow(UnauthorizedException);
            await expect(res).rejects.toThrow("User not found.");
        });

        it("should throw incorrect password error with incorrect password", async () => {
            const res = async () =>
                await authService.validateUser("test", "qweasdzxc1");
            await expect(res).rejects.toThrow(UnauthorizedException);
            await expect(res).rejects.toThrow("Incorrect password.");
        });
    });

    describe("validateToken", () => {
        // TODO: move this sessions type to an interface

        it("should successfully validate token (should not return the profile object)", async () => {
            const userInfoWithSession: User & {
                sessionId: string;
                sessionName: string;
            } = { ...user, sessionId: "aSessionId", sessionName: "aa" };
            const token = "token";
            const mockFindOne = jest
                .spyOn(authService, "findOneByToken")
                .mockResolvedValue(userInfoWithSession);
            const mockTouchSession = jest.spyOn(authService, "touchSession");

            await expect(authService.validateToken(token)).resolves.toBe(
                userInfoWithSession
            );

            expect(mockFindOne).toBeCalledWith(token, undefined);

            expect(mockFindOne).toBeCalledTimes(1);

            expect(mockTouchSession).toBeCalledWith(
                userInfoWithSession.sessionId
            );

            expect(mockTouchSession).toBeCalledTimes(1);
        });

        it("should successfully validate token (should return the profile object)", async () => {
            const userInfoWithSession: User & {
                sessionId: string;
                sessionName: string;
            } = {
                ...user,
                sessionId: "aSessionId",
                sessionName: "aa",
                profile: {
                    relations: [{ id: "awe", status: RelationStatus.Friend }],
                },
            };
            const token = "token";
            const mockFindOne = jest
                .spyOn(authService, "findOneByToken")
                .mockResolvedValue(userInfoWithSession);
            const mockTouchSession = jest.spyOn(authService, "touchSession");

            await expect(authService.validateToken(token, true)).resolves.toBe(
                userInfoWithSession
            );

            expect(mockFindOne).toBeCalledWith(token, true);

            expect(mockFindOne).toBeCalledTimes(1);

            expect(mockTouchSession).toBeCalledWith(
                userInfoWithSession.sessionId
            );

            expect(mockTouchSession).toBeCalledTimes(1);
        });

        it("should throw invalid session token when non-existent session is provided", async () => {
            const invalidToken = "invalidToken";

            const fn = async () =>
                await authService.validateToken(invalidToken);

            const mockFindOne = jest
                .spyOn(authService, "findOneByToken")
                .mockResolvedValue("session-not-found");
            const mockTouchSession = jest.spyOn(authService, "touchSession");

            await expect(fn).rejects.toThrow(UnauthorizedException);

            expect(mockFindOne).toBeCalledTimes(1);

            await expect(fn).rejects.toThrow("Invalid session token.");

            expect(mockFindOne).toBeCalledTimes(2);

            expect(mockTouchSession).toBeCalledTimes(0);

            expect(mockFindOne).toBeCalledWith(invalidToken, undefined);
        });

        it("should throw invalid session token when user doesn't exist but the session does", async () => {
            const token = "token";
            const mockFindOne = jest
                .spyOn(authService, "findOneByToken")
                .mockResolvedValue("user-not-found");
            const mockTouchSession = jest.spyOn(authService, "touchSession");

            const fn = async () => await authService.validateToken(token);

            await expect(fn).rejects.toThrow(UnauthorizedException);

            expect(mockFindOne).toBeCalledTimes(1);

            await expect(fn).rejects.toThrow("Invalid session token.");

            expect(mockFindOne).toBeCalledTimes(2);

            expect(mockTouchSession).toBeCalledTimes(0);

            expect(mockFindOne).toBeCalledWith(token, undefined);
        });
    });

    describe("findOneByToken", () => {
        const validToken = session.token;
        const validTokenNonExistentUser = sessionOfNonExistentUser.token;
        const nonExistentToken = "nonExistentToken";

        it("should find a user by validToken (should not return the profile object)", async () => {
            await expect(
                authService.findOneByToken(validToken)
            ).resolves.toStrictEqual({
                ...user,
                sessionId: session._id,
                sessionName: session.name,
            });
            expect(mongo.sessions.findOne).toBeCalledWith(
                { token: validToken },
                { projection: sessionProjection }
            );
            expect(usersService.findOneNoProfileById).toBeCalledTimes(1);
            expect(usersService.findOneNoProfileById).toBeCalledWith(user.id);
            expect(usersService.findOneById).toBeCalledTimes(0);
        });

        it("should find a user by validToken (should return the profile object)", async () => {
            await expect(
                authService.findOneByToken(validToken, true)
            ).resolves.toStrictEqual({
                ...userWithProfile,
                sessionId: session._id,
                sessionName: session.name,
            });
            expect(mongo.sessions.findOne).toBeCalledWith(
                { token: validToken },
                { projection: sessionProjection }
            );
            expect(usersService.findOneNoProfileById).toBeCalledTimes(0);
            expect(usersService.findOneById).toBeCalledTimes(1);
            expect(usersService.findOneById).toBeCalledWith(userWithProfile.id);
        });

        it("should return session-not-found", async () => {
            await expect(
                authService.findOneByToken(nonExistentToken)
            ).resolves.toBe("session-not-found");
            expect(mongo.sessions.findOne).toBeCalledWith(
                { token: nonExistentToken },
                { projection: sessionProjection }
            );
            expect(usersService.findOneNoProfileById).toBeCalledTimes(0);
            expect(usersService.findOneById).toBeCalledTimes(0);
        });

        it("should return user-not-found", async () => {
            await expect(
                authService.findOneByToken(validTokenNonExistentUser)
            ).resolves.toBe("user-not-found");
            expect(mongo.sessions.findOne).toBeCalledWith(
                { token: validTokenNonExistentUser },
                { projection: sessionProjection }
            );
            expect(usersService.findOneNoProfileById).toBeCalledWith(
                sessionOfNonExistentUser.userId
            );
            expect(usersService.findOneNoProfileById).toBeCalledTimes(1);
            expect(usersService.findOneById).toBeCalledTimes(0);
        });
    });

    // so we can share the mocks.
    describe("createSession", () => {
        const sessionToken = "aSessionToken";
        const sessionId = "aSessionId";
        const sessionName = "aSessionName";
        jest.mock("ulid");

        jest.spyOn(nanoid, "nanoid").mockResolvedValue(sessionToken);
        jest.spyOn(ulid, "ulid").mockReturnValue(sessionId);
        jest.spyOn(Date, "now").mockReturnValue(currentTime);

        it("should create session (with no name)", async () => {
            await expect(
                authService.createSession(user.id)
            ).resolves.toStrictEqual({ id: sessionId, token: sessionToken });
            expect(mongo.sessions.insertOne).toBeCalledWith({
                userId: user.id,
                _id: sessionId,
                token: sessionToken,
                expiresAt: new Date(currentTime + idleTimeout),
            });
            expect(config.get).toBeCalledWith("sessionMaxAge");
        });
        it("should create session (with name)", async () => {
            await expect(
                authService.createSession(user.id, sessionName)
            ).resolves.toStrictEqual({ id: sessionId, token: sessionToken });
            expect(mongo.sessions.insertOne).toBeCalledWith({
                userId: user.id,
                _id: sessionId,
                token: sessionToken,
                name: sessionName,
                expiresAt: new Date(currentTime + idleTimeout),
            });
            expect(config.get).toBeCalledWith("sessionMaxAge");
        });
    });

    describe("touchSession", () => {
        const sessionId = "aSessionId";
        it("should touch session", async () => {
            authService.touchSession(sessionId);
            expect(mongo.sessions.updateOne).toBeCalledWith(
                { _id: sessionId },
                {
                    $set: {
                        expiresAt: new Date(currentTime + idleTimeout),
                    },
                }
            );
        });
    });

    describe("deleteSession", () => {
        const sessionId = "aSessionId";

        it("should delete session", () => {
            authService.deleteSession(sessionId);
            expect(mongo.sessions.deleteOne).toBeCalledWith({ _id: sessionId });
        });
    });
});
