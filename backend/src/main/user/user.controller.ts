import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { AuthenticationGuard } from './authentication/authentication.guard';
import { UpdatePasswordDto } from './authentication/dto/authenticate.dto';
import { UserDto } from './dto/user.dto';
import { UserService } from './user.service';

@UseGuards(AuthenticationGuard)
@Controller('user')
@ApiTags('User')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Unauthorized' })
export class UserController {
  constructor(private readonly usersService: UserService) {}

  @Patch('update-password')
  async updatePassword(
    @Req() req: { user: { id: number } },
    @Body() body: UpdatePasswordDto,
  ) {
    const userId = req.user.id;
    await this.usersService.updatePassword(userId, body);
  }

  @Get('')
  async user(@Req() req: { user: { id: number } }): Promise<UserDto> {
    return new UserDto(
      await this.usersService.findById(req.user.id, {
        balances: true,
        bonusBalances: true, // Добавляем бонусные балансы
      }),
    );
  }
}
