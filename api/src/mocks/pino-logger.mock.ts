const pinoLoggerMock = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
}
export default pinoLoggerMock

export type PinoLoggerMock = typeof pinoLoggerMock