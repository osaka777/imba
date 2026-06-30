import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString } from 'class-validator';
import {
  ApiBearerAuth,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { AuthenticationGuard } from './authentication/authentication.guard';
import { UpdatePasswordDto } from './authentication/dto/authenticate.dto';
import { UserDto } from './dto/user.dto';
import { UserService } from './user.service';

const AVATAR_PRESETS = ['violet', 'cyan', 'amber', 'rose', 'emerald', 'slate'] as const;

class UpdateAvatarPresetDto {
  @IsOptional()
  @IsString()
  @IsIn([...AVATAR_PRESETS, ''])
  preset?: string;
}

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

  @Patch('avatar-preset')
  async updateAvatarPreset(
    @Req() req: { user: { id: number } },
    @Body() body: UpdateAvatarPresetDto,
  ) {
    const preset = body.preset?.trim() || null;
    if (preset && !AVATAR_PRESETS.includes(preset as (typeof AVATAR_PRESETS)[number])) {
      return { ok: false };
    }
    await this.usersService.updateAvatarPreset(req.user.id, preset);
    return { ok: true, avatarPreset: preset };
  }

  @Get('')
  async user(@Req() req: { user: { id: number } }): Promise<UserDto> {
    const user = await this.usersService.findById(req.user.id, {
      balances: true,
      bonusBalances: true,
    });
    return new UserDto({
      ...user,
      telegramLinked: Boolean(user?.telegramLinkedAt),
      telegramNotifyDeposit: user?.telegramNotifyDeposit,
      telegramNotifyWithdraw: user?.telegramNotifyWithdraw,
      telegramNotifyBets: user?.telegramNotifyBets,
      telegramNotifyPromo: user?.telegramNotifyPromo,
      telegram2faEnabled: user?.telegram2faEnabled,
      avatarPreset: user?.avatarPreset,
    });
  }
}
