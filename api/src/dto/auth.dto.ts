import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
    @IsString()
    @IsNotEmpty()
    username: string;

    @IsString()
    @IsNotEmpty()
    password: string;
}

export interface LoginResponseDto {
    token: string;
}

export interface GetUserDto {
    id: string;
    username: string;
}