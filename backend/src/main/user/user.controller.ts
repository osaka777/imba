import { Body, Controller, Get, NotFoundException, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import {
  ApiBearerAuth,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { AuthenticationGuard } from './authentication/authentication.guard';
import { UpdatePasswordDto } from './authentication/dto/authenticate.dto';
import { UserDto } from './dto/user.dto';
import { UserService } from './user.service';
import { PhoneVerificationService } from './phone-verification.service';

const AVATAR_PRESETS = ['violet', 'cyan', 'amber', 'rose', 'emerald', 'slate'] as const;

class UpdateAvatarPresetDto {
  @IsOptional()
  @IsString()
  @IsIn([...AVATAR_PRESETS, ''])
  preset?: string;
}

class RequestPhoneCodeDto {
  @IsString()
  @MaxLength(20)
  phone!: string;
}

class VerifyPhoneCodeDto {
  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}

@UseGuards(AuthenticationGuard)
@Controller('user')
@ApiTags('User')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Unauthorized' })
export class UserController {
  constructor(
    private readonly usersService: UserService,
    private readonly phoneVerification: PhoneVerificationService,
  ) {}

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

  @Get('kyc-limits')
  async kycLimits(@Req() req: { user: { id: number } }) {
    const user = await this.usersService.findById(req.user.id);
    return this.phoneVerification.getWithdrawalLimits(
      user?.phoneVerifiedAt,
      user?.defaultCurrencyCode || 'KZT',
    );
  }

  @Post('phone/request-code')
  async requestPhoneCode(
    @Req() req: { user: { id: number } },
    @Body() body: RequestPhoneCodeDto,
  ) {
    return this.phoneVerification.requestCode(req.user.id, body.phone);
  }

  @Post('phone/verify')
  async verifyPhoneCode(
    @Req() req: { user: { id: number } },
    @Body() body: VerifyPhoneCodeDto,
  ) {
    return this.phoneVerification.verifyCode(req.user.id, body.code);
  }

  @Get('settings')
  async settings(@Req() req: { user: { id: number } }) {
    const user = await this.usersService.findSettingsProfile(req.user.id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      phoneVerified: Boolean(user.phoneVerifiedAt),
      telegramLinked: Boolean(user.telegramLinkedAt),
      telegramUsername: user.telegramUsername,
      avatarPreset: user.avatarPreset,
    };
  }

  @Get('')
  async user(@Req() req: { user: { id: number } }): Promise<UserDto> {
    const user = await this.usersService.findById(req.user.id, {
      balances: true,
      bonusBalances: true,
    });
    return new UserDto({
      ...user,
      phone: user?.phone,
      phoneVerifiedAt: user?.phoneVerifiedAt,
      phoneVerified: Boolean(user?.phoneVerifiedAt),
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
