import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { SupportRateLimitGuard } from '~/common/guards/support-rate-limit.guard';

import { CreateSupportMessageDto } from './dto/create-support-message.dto';
import { SupportService } from './support.service';

@ApiTags('Support')
@Controller('')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get('support/config')
  getConfig() {
    return this.supportService.getPublicConfig();
  }

  @Post('support/message')
  @UseGuards(SupportRateLimitGuard)
  async sendMessage(@Body() body: CreateSupportMessageDto, @Req() req: Request) {
    const forwarded = req.headers['x-forwarded-for'];
    const ip =
      (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : '') ||
      req.ip ||
      req.socket?.remoteAddress;

    return this.supportService.sendMessage(body, {
      authorization: req.headers.authorization,
      cookies: req.cookies as Record<string, string | undefined>,
      ip,
    });
  }
}
