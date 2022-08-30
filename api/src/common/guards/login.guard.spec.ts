import pinoLoggerMock from "@/mocks/pino-logger.mock"
import { BadRequestException, HttpStatus } from "@nestjs/common"
import { AuthGuard } from "@nestjs/passport"
import { LoginGuard } from "./login.guard"

describe("LoginGuard", () => {
    let loginGuard: LoginGuard
    const mockCanActivate = jest.fn()
    const mockSwitchToHttp = jest.fn();
    const mockGetRequest = jest.fn()
    beforeEach(() => { 
        AuthGuard("local").prototype.canActivate = mockCanActivate;  
        loginGuard = new LoginGuard(pinoLoggerMock as any)
    })
    afterEach(() => {
        mockSwitchToHttp.mockReset()
        mockGetRequest.mockReset()
        mockCanActivate.mockReset()
    })

    describe("happy path", () => {

        afterEach(() => {
            expect(pinoLoggerMock.warn).not.toBeCalled()
            expect(mockGetRequest).toBeCalled()
        });
        beforeEach(() => {
            mockCanActivate.mockReturnValue(true)
        })
        it("should pass validation and assign session name", async () => {
            const body = {
                username: "username",
                password: "password",
                friendlyName: "Chrome on Linux"
            };
            const executionContext = buildExecutionContextMock(body, {})

            await expect(loginGuard.canActivate(executionContext as any)).resolves.toBe(true)
            
            expect(mockGetRequest.mock.results[0].value?.user?.sessionName).toBe(body.friendlyName)
            expect(mockCanActivate).toBeCalledWith(executionContext)
        });
        it("should pass validation and not assign session name", async () => {
            const body = {
                username: "username",
                password: "password"
            };
            const executionContext = buildExecutionContextMock(body, {})

            await expect(loginGuard.canActivate(executionContext as any)).resolves.toBe(true)
            
            expect(mockGetRequest.mock.results[0].value?.user?.sessionName).toBe(undefined)
            expect(mockCanActivate).toBeCalledWith(executionContext)
        });  
    })

    describe("unhappy path", () => {

        afterEach(() => {

            expect(pinoLoggerMock.warn).toBeCalled()
            expect(mockCanActivate).not.toBeCalled()
        })
        it("should throw BadRequestException with empty request body", async() => {
            const executionContext = buildExecutionContextMock({}, {})

            const expectedError = {
                statusCode: HttpStatus.BAD_REQUEST,
                message: {
                    validationError: {
                        username: ["username should not be empty", "username must be a string"],
                        password: ["password should not be empty", "password must be a string"],
                    }

                }
            }

            await expect(loginGuard.canActivate(executionContext as any)).rejects.toThrowError(BadRequestException)
            expect(await loginGuard.canActivate(executionContext as any).catch((e: BadRequestException) => e.getResponse())).toEqual(expectedError)
        })
        it("should throw BadRequestException with marformed request body", async () => {
            const body = {
                username: ["ahhaah"],
                password: true,
                friendlyName: "repeat this so its greater than 100 chars".repeat(3)
            };
            const executionContext = buildExecutionContextMock(body, {})
            const expectedError = {
                statusCode: HttpStatus.BAD_REQUEST,
                message: {
                    validationError: { 
                        username: ["username must be a string"], 
                        password: ["password must be a string"], 
                        friendlyName: ["friendlyName must be shorter than or equal to 100 characters"] 
                    }
                    
                }
            }
                        
            await expect(loginGuard.canActivate(executionContext as any)).rejects.toThrowError(BadRequestException)
            expect(await loginGuard.canActivate(executionContext as any).catch((e: BadRequestException) => e.getResponse())).toEqual(expectedError)
        })
    })

    const buildExecutionContextMock = (body: any, user: any) => {

        const executionContext = {
            switchToHttp: mockSwitchToHttp.mockImplementation(() => ({ 
                getRequest: mockGetRequest.mockReturnValue({ body: body, user: user }) 
            }))

        };
        return executionContext

    }
})