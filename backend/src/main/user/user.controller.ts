import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import {
  ApiBearerAuth,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname } from 'path';

import { AuthenticationGuard } from './authentication/authentication.guard';
import { UpdatePasswordDto } from './authentication/dto/authenticate.dto';
import { UserDto } from './dto/user.dto';
import { NICKNAME_MAX, validateNickname } from './nickname';
import { UserService } from './user.service';
import { PhoneVerificationService } from './phone-verification.service';

const AVATAR_DIR = './uploads/avatars';

if (!existsSync(AVATAR_DIR)) {
  mkdirSync(AVATAR_DIR, { recursive: true });
}

class UpdateNicknameDto {
  @IsOptional()
  @IsString()
  @MaxLength(NICKNAME_MAX)
  nickname?: string | null;
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

  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: AVATAR_DIR,
        filename: (req, file, cb) => {
          const userId = (req as { user?: { id?: number } }).user?.id ?? 0;
          const suffix = Date.now();
          const ext = extname(file.originalname || '').toLowerCase() || '.jpg';
          const safeExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)
            ? ext
            : '.jpg';
          cb(null, `u${userId}-${suffix}${safeExt}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          return cb(new BadRequestException('Only image files allowed'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadAvatar(
    @Req() req: { user: { id: number } },
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    const avatarUrl = `/uploads/avatars/${file.filename}`;
    await this.usersService.updateAvatarUrl(req.user.id, avatarUrl);
    return { ok: true, avatarUrl };
  }

  @Patch('nickname')
  async updateNickname(
    @Req() req: { user: { id: number } },
    @Body() body: UpdateNicknameDto,
  ) {
    const parsed = validateNickname(body.nickname ?? '');
    if (parsed.ok === false) {
      throw new BadRequestException({
        code: parsed.code,
        message: parsed.code,
      });
    }
    const nickname = await this.usersService.updateNickname(
      req.user.id,
      parsed.value,
    );
    return { ok: true, nickname };
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
      avatarUrl: user.avatarUrl,
      nickname: user.nickname,
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
      avatarUrl: user?.avatarUrl,
      nickname: user?.nickname,
    });
  }
}
