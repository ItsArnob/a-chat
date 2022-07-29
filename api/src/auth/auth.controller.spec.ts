import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ModuleMocker, MockFunctionMetadata } from 'jest-mock';
import { MONGODB_PROVIDER } from '@/constants';
import { WebsocketService } from '@/websocket/websocket.service';
import { UsersService } from '@/users/users.service';

const moduleMocker = new ModuleMocker(global);


describe('AuthController', () => {
    let authController: AuthController;
    let authService: AuthService;
    let websocketService: WebsocketService;
    let usersService: UsersService;
    beforeEach(async () => {
        const app: TestingModule = await Test.createTestingModule({
            controllers: [AuthController],
            providers: [AuthService],
        }).useMocker(token => {
            if(token === MONGODB_PROVIDER) {
                return {
                    sessions: {
                        deleteOne: jest.fn(),
                    }

                };
            }
            if (typeof token === 'function') {
                const mockMetadata = moduleMocker.getMetadata(token) as MockFunctionMetadata<any, any>;
                const Mock = moduleMocker.generateFromMetadata(mockMetadata);
                return new Mock();
            }
        }).compile();

        authController = app.get<AuthController>(AuthController);
        authService = app.get<AuthService>(AuthService);
        websocketService = app.get<WebsocketService>(WebsocketService);
        usersService = app.get<UsersService>(UsersService);
    });

    const req = {
        user: { id: "1", username: "username", passwordHash: "awe", sessionId: "1", sessionName: "Chrome on Linux" }
    }

    it("should return the user", () => {
        
        
        expect(authController.user(req as any)).toStrictEqual({ id: req.user.id, username: req.user.username })
    });

    it("should logout the user", async() => {
        
        jest.spyOn(authService, "deleteSession").mockResolvedValue({ acknowledged: true, deletedCount: 1 });
        
        await expect(authController.logout(req as any)).resolves.toBe(undefined);
        expect(authService.deleteSession).toBeCalledWith(req.user.sessionId);
        expect(websocketService.logoutSession).toBeCalledWith(req.user.sessionId);

        expect(authService.deleteSession).toBeCalledTimes(1);
        expect(websocketService.logoutSession).toBeCalledTimes(1);
    });

    it("should register user", async() => {
        const user = {
            username: req.user.username,
            password: 'password'
        }
        jest.spyOn(usersService, 'createUser').mockResolvedValue(undefined);
        await expect(authController.createUser(user)).resolves.toBe(undefined);

        expect(usersService.createUser).toBeCalledWith(user.username, user.password);
        expect(usersService.createUser).toBeCalledTimes(1);
    });

    it("should create session (login)", async() => {
        
        const session = { id: 'sessionId', sessionName: req.user.sessionName, token: "token" }
        jest.spyOn(authService, 'createSession').mockResolvedValue(session);

        await expect(authController.login(req as any)).resolves.toStrictEqual({ id: req.user.id, username: req.user.username, session });
        expect(authService.createSession).toBeCalledWith(req.user.id, req.user.sessionName);
        expect(authService.createSession).toBeCalledTimes(1);

    })

});