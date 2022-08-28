import { RelationStatus, User, UserNoProfile } from "@/models/user.model";
import { Test } from "@nestjs/testing";
import { AuthService } from "./auth.service";
import { ModuleMocker, MockFunctionMetadata } from "jest-mock";
import { LocalStrategy } from "./local.strategy";
import {
    InternalServerErrorException,
    UnauthorizedException,
} from "@nestjs/common";
import { getLoggerToken } from "nestjs-pino";
import pinoLoggerMock from "@/mocks/pino-logger.mock";

const moduleMocker = new ModuleMocker(global);

describe("LOcalStrategy", () => {
    let authService: AuthService;
    let localStrategy: LocalStrategy;

    beforeEach(async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [LocalStrategy, {
                provide: getLoggerToken(LocalStrategy.name),
                useValue: pinoLoggerMock
            }],
        })
            .useMocker((token) => {
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
        localStrategy = moduleRef.get<LocalStrategy>(LocalStrategy);
    });

    const password = "password";
    const username = "test";

    it("should validate user", async () => {
        const user: UserNoProfile = {
            id: "1",
            passwordHash: "passwordHash",
            username,
        };
        jest.spyOn(authService, "validateUser").mockResolvedValue(user);

        await expect(localStrategy.validate(username, password)).resolves.toBe(
            user
        );
        expect(authService.validateUser).toBeCalledWith(username, password);
        expect(authService.validateUser).toBeCalledTimes(1);
    });

    it("should throw invalid username or password with incorrect credentials", async () => {
        const message = "Invalid username or password.";

        jest.spyOn(authService, "validateUser").mockRejectedValue(
            new UnauthorizedException(message)
        );

        const fn = async () => await localStrategy.validate(username, password);

        await expect(fn).rejects.toThrow(UnauthorizedException);
        expect(authService.validateUser).toBeCalledTimes(1);
        await expect(fn).rejects.toThrow(message);
        expect(authService.validateUser).toBeCalledTimes(2);
        expect(authService.validateUser).toBeCalledWith(username, password);
    });

    it("should throw internalServerError when unknown error occurres", async () => {
        jest.spyOn(authService, "validateUser").mockRejectedValue(
            new Error("haha unknown error!")
        );

        await expect(
            localStrategy.validate(username, password)
        ).rejects.toThrow(InternalServerErrorException);
        expect(authService.validateUser).toBeCalledTimes(1);
        expect(authService.validateUser).toBeCalledWith(username, password);
    });
});
