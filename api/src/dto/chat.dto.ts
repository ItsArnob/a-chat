
import { Transform, TransformFnParams } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class messageDto {

    @MinLength(1)
    @MaxLength(1024)
    @IsString()
    @Transform(({ value }: TransformFnParams) => typeof value === 'string' ? value?.trim() : value )
    content: string;
}