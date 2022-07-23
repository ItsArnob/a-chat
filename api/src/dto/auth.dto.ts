import { PASSWORD_PATTERN, USERNAME_PATTERN } from "@/constants";
import {
    IsNotEmpty,
    IsOptional,
    IsString,
    Length,
    Matches,
} from "class-validator";

export class LoginDto {
    @IsString()
    @IsNotEmpty()
    username: string;

    @IsString()
    @IsNotEmpty()
    password: string;

    @IsOptional()
    @Length(1, 100)
    friendlyName: string;
}

export class CreateUserDto {
    @Length(3, 30)
    @Matches(USERNAME_PATTERN)
    username: string;

    @Length(8, 72)
    @Matches(PASSWORD_PATTERN)
    password: string;
}

export interface LoginResponseDto {
    token: string;
}

export interface GetUserDto {
    id: string;
    username: string;
}
