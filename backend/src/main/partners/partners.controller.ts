import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { AffilatorType } from '@prisma/client';
import { SuperuserGuard } from '../user/authentication/superuser.guard';
import { PartnersService } from './partners.service';

@Controller('partners')
export class PartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  @Get('all')
  @UseGuards(SuperuserGuard)
  async getAllPartners() {
    return this.partnersService.getAllPartners();
  }

  @Post('create')
  @UseGuards(SuperuserGuard)
  async createPartner(@Body() data: {
    email: string;
    password: string;
    trafficSource: string;
    percent: number;
    affilatorsPercent?: number;
    type?: AffilatorType;
  }) {
    return this.partnersService.createPartner(data);
  }
}