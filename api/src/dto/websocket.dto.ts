import { IsString } from "class-validator";

export class ChatTypingDto {

    @IsString()
    chatId: string
}