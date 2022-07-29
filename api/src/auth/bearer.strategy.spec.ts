import { RelationStatus, User } from "@/models/user.model";
import { Test } from "@nestjs/testing"
import { AuthService } from "./auth.service";
import { BearerStrategy } from "./bearer.strategy"
import { ModuleMocker, MockFunctionMetadata } from 'jest-mock';

const moduleMocker = new ModuleMocker(global);


describe("passport Bearer Strategy", () => {
    let authService: AuthService;
    let bearerStrategy: BearerStrategy;

    beforeEach(async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [BearerStrategy]
        }).useMocker(token => {
            if (typeof token === 'function') {
                const mockMetadata = moduleMocker.getMetadata(token) as MockFunctionMetadata<any, any>;
                const Mock = moduleMocker.generateFromMetadata(mockMetadata);
                return new Mock();
            }
        }).compile();
        authService = moduleRef.get<AuthService>(AuthService);
        bearerStrategy = moduleRef.get<BearerStrategy>(BearerStrategy);
    });

    it("Should validate token", async() => {
        const userFromToken: User & {
            sessionName?: string | undefined;
            sessionId: string;
        } = {
            id: "1",
            passwordHash: "hashedpassword",
            sessionId: "1",
            username: "username",
            profile: { relations: [{ id: "3", status: RelationStatus.Friend }]},
            sessionName: "Chrome on linux"

        }
        const token = 'token';
        jest.spyOn(authService, "validateToken").mockResolvedValue(userFromToken);
        expect(bearerStrategy.validate(token)).resolves.toBe(userFromToken);
        expect(authService.validateToken).toBeCalledWith(token);
        expect(authService.validateToken).toBeCalledTimes(1);
    })
})