import { ULID_PATTERN } from "@/constants";
import { Transform, TransformFnParams } from "class-transformer";
import {
    IsOptional,
    IsString,
    Length,
    Matches,
    Max,
    MaxLength,
    Min,
    MinLength,
} from "class-validator";

export class messageDto {
    @MinLength(1)
    @MaxLength(1024)
    @IsString()
    @Transform(({ value }: TransformFnParams) =>
        typeof value === "string" ? value?.trim() : value
    )
    content: string;

    @IsOptional()
    @Length(26, 26)
    @Matches(ULID_PATTERN)
    ackId?: string;
}

export class GetMessagesQueryDto {
    @IsOptional()
    @Length(26, 26)
    @Matches(ULID_PATTERN)
    before?: string;

    @IsOptional()
    @Length(26, 26)
    @Matches(ULID_PATTERN)
    after?: string;

    @IsOptional()
    @Transform(({ value }) => Number(value))
    @Min(1)
    @Max(100)
    limit?: number;
}

export interface SaveDirectMessageDto {
    id: string;
    timestamp: number;
    chatId: string;
    authorId: string;
    content: string;
}
export interface SaveDirectMessageResponseDto
    extends Omit<SaveDirectMessageDto, "recipients"> {
    ackId?: string | undefined;
}

export interface OnlineSocketsList
    extends Map<string, { sIds: string[]; online: Date | boolean }> {}
