import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { UlidValidatorPipe } from '@/common/pipes/ulid-validator.pipe';
import { AddFriendParamsDto, AddFriendQueryDto, AddFriendResponseDto, RemoveFriendDto } from '@/dto/user.dto';
import { Chat } from '@/models/chat.model';
import { WebsocketService } from '@/websocket/websocket.service';
import {
    Controller,
    Delete,
    Param,
    Put,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {

    constructor(
        private usersService: UsersService,
        private websocketService: WebsocketService
    ) {}

     @Put('/:usernameOrId/friend')
    @UseGuards(JwtAuthGuard)
    async addFriend(
        @Param() params: AddFriendParamsDto,
        @Query() query: AddFriendQueryDto,
        @Req() req: Request
    ): Promise<AddFriendResponseDto> {
        const result = await this.usersService.addFriend(
            params.usernameOrId,
            req.user,
            query.type === 'id'
        );
        if (result.message === 'Friend request accepted.') {
            this.websocketService.emitFriendAdded(req.user.id, result.user.id, (result.chat as Chat)); // HELP: chat will exist since friend request was accepted. any better way to handle this?
        } else {
            this.websocketService.emitNewFriendRequest({ id: req.user.id, username: req.user.username }, result.user);
        }
        return result;
    }

    @Delete('/:id/friend')
    @UseGuards(JwtAuthGuard)
    async removeFriend(
        @Param('id', new UlidValidatorPipe()) userId: string,
        @Req() req: Request
    ): Promise<RemoveFriendDto> {
        const result = await this.usersService.removeFriend(userId, req.user);
        this.websocketService.emitFriendRemoved(req.user.id, userId, result.message);
        return result;
    }

}
