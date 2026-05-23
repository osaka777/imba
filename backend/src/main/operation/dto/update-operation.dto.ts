import { PartialType } from '@nestjs/swagger';

import { CreateOperationDto } from '~/main/operation/dto/create-operation.dto';

export class UpdateOperationDto extends PartialType(CreateOperationDto) {}
