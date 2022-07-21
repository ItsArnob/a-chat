import { Chat } from "@/models/chat.model";
import { Transform, TransformFnParams } from "class-transformer";
import { IsIn, IsOptional, MinLength } from "class-validator";

export class AddFriendParamsDto {
    @Transform(({ value }: TransformFnParams) =>
        typeof value === "string" ? value?.trim() : value
    )
    @MinLength(1)
    usernameOrId: string;
}
export class AddFriendQueryDto {
    @Transform(({ value }: TransformFnParams) =>
        typeof value === "string" ? value?.trim()?.toLowerCase() : value
    )
    @IsIn(["id", "username"])
    @IsOptional()
    type?: string;
}

export interface AddFriendDto {
    user: {
        id: string;
        username: string;
    };
    message: string;
    chat?: Chat;
}

export interface RemoveFriendDto {
    user: {
        id: string;
    };
    chatId?: string | undefined;
    message: string;
}
export interface AddFriendResponseDto extends Omit<AddFriendDto, "chat"> {}
