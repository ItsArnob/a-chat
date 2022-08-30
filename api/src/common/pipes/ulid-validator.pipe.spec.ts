import { BadRequestException } from "@nestjs/common"
import { ulid } from "ulid"
import { UlidValidatorPipe } from "./ulid-validator.pipe"

describe("UlidValidatorPipe", () => {

    let ulidValidator: UlidValidatorPipe

    beforeEach(() => {
        ulidValidator = new UlidValidatorPipe()
    })

    it("should successfully validate ulid", () => {
        const ulid = "01GBMND6AQC1QE3D7G05Z65ND8"

        expect(ulidValidator.transform(ulid)).toBe(ulid)
    })

    it("should successfully validate ulid with random ulid (x10)", () => {
        
        for(let i = 0; i < 10; i++) {

            const id = i == 0 ? ulid() : ulid(Math.floor(Date.now() / (Math.random() * 3)))
            expect(ulidValidator.transform(id)).toBe(id)
        }
    })

    it("should throw BadRequestException when invalid ulid is provided ( length != 26)", () => {
        const id = "GBMND6AQC1QE3D7G05Z65ND"

        expect(() => ulidValidator.transform(id)).toThrowError(BadRequestException)
        expect(() => ulidValidator.transform(id)).toThrowError("Invalid ID.")

    })

    it("should throw BadRequestException when invalid ulid is provided (invalid chars)", () => {
        const id = "01GBMND6AQC1QE3I7G0OZ6ULD8"
        expect(() => ulidValidator.transform(id)).toThrowError(BadRequestException)
        expect(() => ulidValidator.transform(id)).toThrowError("Invalid ID.")
    })

    it("should throw BadRequestException when non-string argument is provided", () => {
        const id = { id: "id" }
        expect(() => ulidValidator.transform(id)).toThrowError(BadRequestException)
        expect(() => ulidValidator.transform(id)).toThrowError("Invalid ID.")
    })
})