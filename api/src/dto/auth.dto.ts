import { IsNotEmpty, IsString } from 'class-validator';
import { UserDto } from './user.dto';

export class LoginDto {
    @IsString()
    @IsNotEmpty()
    username: string;

    @IsString()
    @IsNotEmpty()
    password: string;
}

export interface LoginResponseDto extends UserDto {
    token: string;
}
